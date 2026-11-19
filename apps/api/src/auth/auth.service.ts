import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { BadRequestException, ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SubscriptionPaymentMethod, SubscriptionPlan, SubscriptionPlanRequestStatus, SubscriptionStatus, UserRole } from '@prisma/client';
import { compare, hash } from 'bcryptjs';
import { PrismaService } from '../database/prisma.service';
import { TenantContextService } from '../database/tenant-context.service';
import { BootstrapPlatformAdminDto, CreatePlatformSchoolDto, CreatePlatformSubscriptionPaymentDto, LoginDto, PlatformAdminLoginDto, RequestSchoolSubscriptionPlanDto, ReviewSchoolSubscriptionPlanRequestDto, UpdateSchoolSubscriptionDto } from './auth.dto';
import { ADMIN_MODULES, RolePermissionEntryDto, UpdateSchoolProfileDto, UpdateUserRoleDto } from '../administration/administration.dto';

const DEMO_SCHOOL_ID = 'demo-school';
const DEFAULT_PLAN_FEES: Record<SubscriptionPlan, number> = {
  STARTER: 10000,
  PRO: 25000,
  PREMIUM: 50000,
  ENTERPRISE: 100000,
  CUSTOM: 0,
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async onModuleInit() {
    const school = await this.prisma.school.upsert({
      where: { id: DEMO_SCHOOL_ID },
      create: { id: DEMO_SCHOOL_ID, slug: 'csp-nouvel-espoir-demo', name: 'CSP Nouvel Espoir de Galmi (démo)' },
      update: {},
    });
    const schools = await this.prisma.school.findMany({ select: { id: true } });
    for (const currentSchool of schools) {
      await this.tenantContext.run({ schoolId: currentSchool.id }, async () => {
        if (currentSchool.id === school.id) {
          await this.prisma.schoolProfile.upsert({ where: { schoolId: currentSchool.id }, create: { schoolId: currentSchool.id }, update: {} });
          await this.prisma.portalSettings.upsert({ where: { schoolId: currentSchool.id }, create: { schoolId: currentSchool.id }, update: {} });
        }
        await this.ensureDefaultSchoolPermissions(currentSchool.id);
      });
    }
  }

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const school = await this.prisma.school.findUnique({ where: { slug: dto.schoolSlug.trim().toLowerCase() } });
    if (!school || !school.isActive) throw new UnauthorizedException('École ou identifiants incorrects.');
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive || !(await compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('École ou identifiants incorrects.');
    }
    const membership = await this.prisma.schoolMembership.findUnique({ where: { schoolId_userId: { schoolId: school.id, userId: user.id } } });
    if (!membership?.isActive) throw new UnauthorizedException('Ce compte n’a pas accès à cette école. Contactez son administrateur.');
    if (membership.role === UserRole.PARENT || user.role === UserRole.PARENT) throw new UnauthorizedException('Utilisez la connexion dédiée au portail parents.');
    await this.tenantContext.run({ schoolId: school.id, userId: user.id, role: membership.role }, async () => {
      await this.prisma.auditLog.create({ data: { action: 'USER_SIGNED_IN', entityType: 'User', entityId: user.id } });
    });
    return this.createSession(user, school, membership.role);
  }

  async bootstrapPlatformAdmin(dto: BootstrapPlatformAdminDto) {
    const expectedKey = process.env.PLATFORM_ADMIN_BOOTSTRAP_KEY;
    const providedKey = Buffer.from(dto.bootstrapKey);
    const configuredKey = Buffer.from(expectedKey ?? '');
    if (!expectedKey || providedKey.length !== configuredKey.length || !timingSafeEqual(providedKey, configuredKey)) {
      throw new UnauthorizedException('Clé de configuration initiale invalide.');
    }
    const email = dto.email.trim().toLowerCase();
    const passwordHash = await hash(dto.password, 12);
    let user;
    try {
      user = await this.prisma.$transaction(async (transaction) => {
        const existing = await transaction.user.findUnique({ where: { email } });
        if (existing) throw new ConflictException('Cette adresse courriel est déjà utilisée. Choisissez une autre adresse pour le compte plateforme.');
        const createdUser = await transaction.user.create({ data: { fullName: dto.fullName.trim(), email, passwordHash, role: UserRole.ADMIN } });
        await transaction.platformAdmin.create({ data: { userId: createdUser.id } });
        return createdUser;
      });
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      if (error && typeof error === 'object' && 'code' in error && (error.code === 'P2002' || error.code === 'P2034')) {
        throw new ConflictException('Le compte plateforme a déjà été initialisé.');
      }
      throw error;
    }
    await this.prisma.platformAuditLog.create({ data: { action: 'PLATFORM_ADMIN_BOOTSTRAPPED', entityType: 'PlatformAdmin', entityId: user.id } });
    return this.createPlatformSession(user);
  }

  async platformLogin(dto: PlatformAdminLoginDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email }, include: { platformAdmin: true } });
    if (!user?.isActive || !user.platformAdmin?.isActive || !(await compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Identifiants administrateur de plateforme incorrects.');
    }
    await this.prisma.platformAuditLog.create({ data: { action: 'PLATFORM_ADMIN_SIGNED_IN', entityType: 'PlatformAdmin', entityId: user.id } });
    return this.createPlatformSession(user);
  }

  async validatePlatformAdmin(userId: string) {
    const admin = await this.prisma.platformAdmin.findUnique({ where: { userId }, include: { user: true } });
    if (!admin?.isActive || !admin.user.isActive) return null;
    return { userId, role: 'PLATFORM_ADMIN' };
  }

  async getCurrentPlatformAdmin(userId: string) {
    const admin = await this.prisma.platformAdmin.findUnique({ where: { userId }, include: { user: true } });
    if (!admin?.isActive || !admin.user.isActive) throw new UnauthorizedException('Accès administrateur de plateforme désactivé.');
    return { user: { id: admin.user.id, fullName: admin.user.fullName, email: admin.user.email, role: 'PLATFORM_ADMIN' as const } };
  }

  async startPlatformSchoolAccess(schoolId: string, actorUserId: string) {
    const access = await this.validatePlatformSchoolAccess(actorUserId, schoolId);
    if (!access) throw new UnauthorizedException('L’accès à cette école est indisponible.');
    const [admin, school] = await Promise.all([
      this.prisma.platformAdmin.findUnique({ where: { userId: actorUserId }, include: { user: true } }),
      this.prisma.school.findUnique({ where: { id: schoolId }, select: { id: true, name: true, slug: true, isActive: true } }),
    ]);
    if (!admin?.isActive || !admin.user.isActive || !school?.isActive) {
      throw new UnauthorizedException('L’accès à cette école est indisponible.');
    }
    const accessToken = await this.jwt.signAsync(
      { sub: actorUserId, schoolId, role: UserRole.ADMIN, tokenType: 'PLATFORM_SCHOOL_ACCESS' },
      { expiresIn: '30m' },
    );
    await this.prisma.platformAuditLog.create({
      data: { actorUserId, action: 'PLATFORM_SCHOOL_ACCESS_STARTED', entityType: 'School', entityId: schoolId, details: { expiresInMinutes: 30 } },
    });
    return {
      accessToken,
      user: { id: admin.user.id, fullName: admin.user.fullName, email: admin.user.email, role: UserRole.ADMIN },
      school: { id: school.id, name: school.name, slug: school.slug },
    };
  }

  async validatePlatformSchoolAccess(userId: string, schoolId: string) {
    const [admin, school] = await Promise.all([
      this.validatePlatformAdmin(userId),
      this.prisma.school.findUnique({ where: { id: schoolId }, select: { id: true, isActive: true } }),
    ]);
    if (!admin || !school?.isActive) return null;
    return { schoolId, userId, role: UserRole.ADMIN };
  }

  async getCurrentPlatformSchool(userId: string, schoolId: string) {
    const access = await this.validatePlatformSchoolAccess(userId, schoolId);
    if (!access) throw new UnauthorizedException('Cette session d’assistance n’est plus active.');
    const [admin, school] = await Promise.all([
      this.prisma.platformAdmin.findUnique({ where: { userId }, include: { user: true } }),
      this.prisma.school.findUnique({ where: { id: schoolId }, select: { id: true, name: true, slug: true, isActive: true } }),
    ]);
    if (!admin?.isActive || !admin.user.isActive || !school?.isActive) {
      throw new UnauthorizedException('Cette session d’assistance n’est plus active.');
    }
    return {
      user: { id: admin.user.id, fullName: admin.user.fullName, email: admin.user.email, role: UserRole.ADMIN },
      school: { id: school.id, name: school.name, slug: school.slug },
      platformAccess: true,
    };
  }

  getCurrentPlatformSchoolPermissions() {
    return {
      role: UserRole.ADMIN,
      permissions: ADMIN_MODULES.map((module) => ({ module, canView: true, canCreate: true, canUpdate: true, canDelete: true })),
    };
  }

  async listCurrentPlatformSchool(userId: string, schoolId: string) {
    const access = await this.validatePlatformSchoolAccess(userId, schoolId);
    if (!access) throw new UnauthorizedException('Cette session d’assistance n’est plus active.');
    const school = await this.prisma.school.findUnique({ where: { id: schoolId }, select: { id: true, name: true, slug: true } });
    if (!school) throw new UnauthorizedException('Cette session d’assistance n’est plus active.');
    return [{ ...school, role: UserRole.ADMIN }];
  }

  async listPlatformSchools() {
    const schools = await this.prisma.school.findMany({
      include: {
        memberships: {
          where: { role: UserRole.ADMIN },
          orderBy: { createdAt: 'asc' },
          take: 1,
          include: { user: { select: { id: true, fullName: true, email: true } } },
        },
        _count: { select: { memberships: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return schools.map(({ memberships, ...school }) => ({
      ...school,
      owner: memberships[0] ? { id: memberships[0].user.id, fullName: memberships[0].user.fullName, email: memberships[0].user.email } : null,
    }));
  }

  async createPlatformSchool(dto: CreatePlatformSchoolDto, actorUserId: string) {
    const email = dto.adminEmail.trim().toLowerCase();
    const schoolId = randomUUID();
    const slug = `${this.slugify(dto.schoolName)}-${randomBytes(3).toString('hex')}`;
    const passwordHash = await hash(dto.adminPassword, 12);
    let created;
    try {
      created = await this.prisma.$transaction(async (transaction) => {
        const existing = await transaction.user.findUnique({ where: { email }, select: { id: true } });
        if (existing) throw new ConflictException('Cette adresse courriel est déjà utilisée. Chaque responsable doit avoir une adresse unique.');
        const user = await transaction.user.create({ data: { fullName: dto.adminFullName.trim(), email, passwordHash, role: UserRole.ADMIN } });
        const school = await transaction.school.create({ data: { id: schoolId, name: dto.schoolName.trim(), slug } });
        await transaction.schoolMembership.create({ data: { schoolId, userId: user.id, role: UserRole.ADMIN } });
        return { user, school };
      });
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
        throw new ConflictException('Cette adresse courriel est déjà utilisée ou l’établissement vient d’être créé.');
      }
      throw error;
    }

    await this.tenantContext.run({ schoolId, userId: created.user.id, role: UserRole.ADMIN }, async () => {
      await this.prisma.schoolProfile.create({ data: { schoolId, name: created.school.name, shortName: created.school.name } });
      await this.prisma.portalSettings.create({ data: { schoolId } });
      await this.ensureDefaultSchoolPermissions(schoolId);
      await this.prisma.auditLog.create({ data: { action: 'SCHOOL_CREATED_BY_PLATFORM', entityType: 'School', entityId: schoolId, details: { ownerUserId: created.user.id } } });
    });
    await this.prisma.platformAuditLog.create({ data: { actorUserId, action: 'PLATFORM_SCHOOL_CREATED', entityType: 'School', entityId: schoolId, details: { ownerUserId: created.user.id } } });
    return {
      id: created.school.id,
      name: created.school.name,
      slug: created.school.slug,
      isActive: created.school.isActive,
      createdAt: created.school.createdAt,
      owner: { fullName: created.user.fullName, email: created.user.email },
      _count: { memberships: 1 },
    };
  }

  async platformBootstrapStatus() {
    return { needsBootstrap: (await this.prisma.platformAdmin.count({ where: { isActive: true, user: { isActive: true } } })) === 0 };
  }

  async setPlatformSchoolStatus(schoolId: string, isActive: boolean, actorUserId: string) {
    const school = await this.prisma.school.update({ where: { id: schoolId }, data: { isActive } });
    await this.prisma.platformAuditLog.create({ data: { action: isActive ? 'PLATFORM_SCHOOL_ACTIVATED' : 'PLATFORM_SCHOOL_SUSPENDED', entityType: 'School', entityId: schoolId, details: { actorUserId } } });
    return school;
  }

  async updateSchoolSubscription(schoolId: string, dto: UpdateSchoolSubscriptionDto, actorUserId: string) {
    const existing = await this.prisma.school.findUnique({ where: { id: schoolId }, select: { id: true, subscriptionStartedAt: true } });
    if (!existing) throw new NotFoundException('Établissement introuvable.');
    const school = await this.prisma.school.update({
      where: { id: schoolId },
      data: {
        subscriptionPlan: dto.subscriptionPlan,
        subscriptionStatus: dto.subscriptionStatus,
        monthlyFee: dto.monthlyFee,
        subscriptionRenewalAt: dto.subscriptionRenewalAt ? new Date(dto.subscriptionRenewalAt) : null,
        subscriptionStartedAt: dto.subscriptionStatus === SubscriptionStatus.ACTIVE
          ? existing.subscriptionStartedAt ?? new Date()
          : existing.subscriptionStartedAt,
      },
    });
    await this.prisma.platformAuditLog.create({
      data: {
        actorUserId,
        action: 'PLATFORM_SCHOOL_SUBSCRIPTION_UPDATED',
        entityType: 'School',
        entityId: schoolId,
        details: { plan: dto.subscriptionPlan, status: dto.subscriptionStatus, monthlyFee: dto.monthlyFee, renewalAt: dto.subscriptionRenewalAt ?? null },
      },
    });
    return school;
  }

  async getSchoolSubscription() {
    const schoolId = this.tenantContext.schoolId();
    if (!schoolId) throw new BadRequestException('Établissement actif introuvable.');
    const [school, request] = await Promise.all([
      this.prisma.school.findUnique({ where: { id: schoolId }, select: { subscriptionPlan: true, subscriptionStatus: true, monthlyFee: true } }),
      this.prisma.subscriptionPlanRequest.findFirst({
        where: { schoolId },
        select: { id: true, plan: true, status: true, requestedAt: true },
        orderBy: { requestedAt: 'desc' },
      }),
    ]);
    if (!school) throw new NotFoundException('Établissement introuvable.');
    return { ...school, request };
  }

  async requestSchoolSubscriptionPlan(dto: RequestSchoolSubscriptionPlanDto, actorUserId: string) {
    const schoolId = this.tenantContext.schoolId();
    if (!schoolId) throw new BadRequestException('Établissement actif introuvable.');
    const existing = await this.prisma.subscriptionPlanRequest.findFirst({
      where: { schoolId, status: SubscriptionPlanRequestStatus.PENDING },
      select: { id: true },
    });
    if (existing) throw new ConflictException('Une demande d’abonnement est déjà en attente de validation.');
    try {
      return await this.prisma.subscriptionPlanRequest.create({
        data: { schoolId, pendingSchoolId: schoolId, plan: dto.plan, requestedBy: actorUserId },
      });
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
        throw new ConflictException('Une demande d’abonnement est déjà en attente de validation.');
      }
      throw error;
    }
  }

  async listPlatformSubscriptionPlanRequests() {
    return this.prisma.subscriptionPlanRequest.findMany({
      where: { status: SubscriptionPlanRequestStatus.PENDING },
      include: { school: { select: { id: true, name: true, subscriptionPlan: true, subscriptionStatus: true } } },
      orderBy: { requestedAt: 'asc' },
    });
  }

  async reviewPlatformSubscriptionPlanRequest(requestId: string, dto: ReviewSchoolSubscriptionPlanRequestDto, actorUserId: string) {
    if (dto.status === SubscriptionPlanRequestStatus.PENDING) {
      throw new BadRequestException('Une demande doit être approuvée ou refusée.');
    }
    return this.prisma.$transaction(async (transaction) => {
      const request = await transaction.subscriptionPlanRequest.findUnique({
        where: { id: requestId },
        include: { school: { select: { id: true, subscriptionPlan: true } } },
      });
      if (!request) throw new NotFoundException('Demande d’abonnement introuvable.');
      if (request.status !== SubscriptionPlanRequestStatus.PENDING) throw new ConflictException('Cette demande a déjà été traitée.');

      const claim = await transaction.subscriptionPlanRequest.updateMany({
        where: { id: requestId, status: SubscriptionPlanRequestStatus.PENDING },
        data: { status: dto.status, pendingSchoolId: null, reviewedAt: new Date(), reviewedBy: actorUserId },
      });
      if (claim.count !== 1) throw new ConflictException('Cette demande a déjà été traitée.');
      if (dto.status === SubscriptionPlanRequestStatus.APPROVED) {
        const setting = await transaction.platformPlanSetting.findUnique({ where: { plan: request.plan } });
        await transaction.school.update({
          where: { id: request.schoolId },
          data: { subscriptionPlan: request.plan, monthlyFee: setting?.monthlyFee ?? DEFAULT_PLAN_FEES[request.plan] },
        });
      }
      await transaction.platformAuditLog.create({
        data: {
          actorUserId,
          action: dto.status === SubscriptionPlanRequestStatus.APPROVED ? 'PLATFORM_SUBSCRIPTION_REQUEST_APPROVED' : 'PLATFORM_SUBSCRIPTION_REQUEST_REJECTED',
          entityType: 'SubscriptionPlanRequest',
          entityId: requestId,
          details: { schoolId: request.schoolId, plan: request.plan },
        },
      });
      return transaction.subscriptionPlanRequest.findUniqueOrThrow({ where: { id: requestId } });
    });
  }

  async listPlatformPlanSettings() {
    const settings = await this.prisma.platformPlanSetting.findMany();
    const savedFees = new Map(settings.map((setting) => [setting.plan, setting.monthlyFee]));
    return Object.values(SubscriptionPlan).map((plan) => ({
      plan,
      monthlyFee: savedFees.get(plan) ?? DEFAULT_PLAN_FEES[plan],
    }));
  }

  async updatePlatformPlanSetting(plan: string, monthlyFee: number, actorUserId: string) {
    if (!Object.values(SubscriptionPlan).includes(plan as SubscriptionPlan)) {
      throw new BadRequestException('Forfait inconnu.');
    }
    const updated = await this.prisma.platformPlanSetting.upsert({
      where: { plan: plan as SubscriptionPlan },
      create: { plan: plan as SubscriptionPlan, monthlyFee },
      update: { monthlyFee },
    });
    await this.prisma.platformAuditLog.create({
      data: {
        actorUserId,
        action: 'PLATFORM_SUBSCRIPTION_PLAN_UPDATED',
        entityType: 'PlatformPlanSetting',
        entityId: updated.plan,
        details: { monthlyFee },
      },
    });
    return updated;
  }

  async listPlatformSubscriptionPayments() {
    return this.prisma.platformSubscriptionPayment.findMany({
      include: { school: { select: { id: true, name: true, subscriptionPlan: true } } },
      orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async createPlatformSubscriptionPayment(dto: CreatePlatformSubscriptionPaymentDto, actorUserId: string) {
    const school = await this.prisma.school.findUnique({ where: { id: dto.schoolId }, select: { id: true } });
    if (!school) throw new NotFoundException('Établissement introuvable.');

    const payment = await this.prisma.platformSubscriptionPayment.create({
      data: {
        schoolId: dto.schoolId,
        amount: dto.amount,
        paidAt: new Date(dto.paidAt),
        period: dto.period,
        method: dto.method as SubscriptionPaymentMethod,
        reference: dto.reference?.trim() || null,
        note: dto.note?.trim() || null,
        recordedBy: actorUserId,
      },
      include: { school: { select: { id: true, name: true, subscriptionPlan: true } } },
    });
    await this.prisma.platformAuditLog.create({
      data: {
        actorUserId,
        action: 'PLATFORM_SUBSCRIPTION_PAYMENT_RECORDED',
        entityType: 'PlatformSubscriptionPayment',
        entityId: payment.id,
        details: { schoolId: payment.schoolId, amount: payment.amount, period: payment.period, method: payment.method },
      },
    });
    return payment;
  }

  async resetPlatformSchoolAdminPassword(schoolId: string, userId: string, password: string, actorUserId: string) {
    const school = await this.prisma.school.findUnique({ where: { id: schoolId }, select: { id: true } });
    if (!school) throw new NotFoundException('Établissement introuvable.');
    const membership = await this.tenantContext.run({ schoolId }, async () =>
      await this.prisma.schoolMembership.findUnique({
        where: { schoolId_userId: { schoolId, userId } },
        select: { id: true, role: true },
      }),
    );
    if (!membership) {
      throw new NotFoundException('Compte introuvable dans cet établissement.');
    }

    const passwordHash = await hash(password, 12);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    await this.tenantContext.run({ schoolId, userId: actorUserId, role: 'PLATFORM_ADMIN' }, async () => {
      await this.prisma.auditLog.create({
        data: { action: 'PLATFORM_USER_PASSWORD_RESET', entityType: 'User', entityId: userId, details: { membershipId: membership.id } },
      });
    });
    await this.prisma.platformAuditLog.create({
      data: { actorUserId, action: 'PLATFORM_SCHOOL_USER_PASSWORD_RESET', entityType: 'User', entityId: userId, details: { schoolId } },
    });
    return { success: true };
  }

  async getPlatformSchoolProfile(schoolId: string) {
    await this.requirePlatformSchool(schoolId);
    return this.tenantContext.run({ schoolId }, async () =>
      this.prisma.schoolProfile.upsert({ where: { schoolId }, create: { schoolId }, update: {} }),
    );
  }

  async updatePlatformSchoolProfile(schoolId: string, dto: UpdateSchoolProfileDto, actorUserId: string) {
    await this.requirePlatformSchool(schoolId);
    return this.tenantContext.run({ schoolId, userId: actorUserId, role: 'PLATFORM_ADMIN' }, async () => {
      const profileData = {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.shortName !== undefined ? { shortName: dto.shortName.trim() } : {}),
        ...(dto.address !== undefined ? { address: dto.address?.trim() || null } : {}),
        ...(dto.city !== undefined ? { city: dto.city.trim() } : {}),
        ...(dto.country !== undefined ? { country: dto.country.trim() } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone?.trim() || null } : {}),
        ...(dto.email !== undefined ? { email: dto.email?.trim().toLowerCase() || null } : {}),
        ...(dto.website !== undefined ? { website: dto.website?.trim() || null } : {}),
        ...(dto.registrationId !== undefined ? { registrationId: dto.registrationId?.trim() || null } : {}),
        ...(dto.logoDataUrl !== undefined ? { logoDataUrl: dto.logoDataUrl?.trim() || null } : {}),
        ...(dto.currency !== undefined ? { currency: dto.currency.toUpperCase() } : {}),
        ...(dto.language !== undefined ? { language: dto.language.toLowerCase() } : {}),
      };
      const profile = await this.prisma.schoolProfile.upsert({ where: { schoolId }, create: { schoolId, ...profileData }, update: profileData });
      await this.prisma.auditLog.create({ data: { action: 'SCHOOL_PROFILE_UPDATED_BY_PLATFORM', entityType: 'SchoolProfile', entityId: profile.id, details: { changedFields: Object.keys(dto) } } });
      return profile;
    }).then(async (profile) => {
      await this.prisma.platformAuditLog.create({ data: { actorUserId, action: 'PLATFORM_SCHOOL_PROFILE_UPDATED', entityType: 'SchoolProfile', entityId: profile.id, details: { schoolId } } });
      return profile;
    });
  }

  async getPlatformSchoolPermissions(schoolId: string) {
    await this.requirePlatformSchool(schoolId);
    return this.tenantContext.run({ schoolId }, async () => {
      const saved = await this.prisma.rolePermission.findMany({ orderBy: [{ role: 'asc' }, { module: 'asc' }] });
      const byKey = new Map(saved.map((permission) => [`${permission.role}:${permission.module}`, permission]));
      return Object.values(UserRole).flatMap((role) => ADMIN_MODULES.map((module) => byKey.get(`${role}:${module}`) ?? {
        id: null, role, module,
        canView: role === UserRole.ADMIN, canCreate: role === UserRole.ADMIN,
        canUpdate: role === UserRole.ADMIN, canDelete: role === UserRole.ADMIN, isDefault: true,
      }));
    });
  }

  async savePlatformSchoolPermissions(schoolId: string, entries: RolePermissionEntryDto[], actorUserId: string) {
    await this.requirePlatformSchool(schoolId);
    const validModules = new Set<string>(ADMIN_MODULES);
    const uniqueEntries = new Map<string, RolePermissionEntryDto>();
    for (const entry of entries) {
      if (!validModules.has(entry.module)) continue;
      uniqueEntries.set(`${entry.role}:${entry.module}`, entry.role === UserRole.ADMIN
        ? { ...entry, canView: true, canCreate: true, canUpdate: true, canDelete: true }
        : { ...entry, canCreate: entry.canView && entry.canCreate, canUpdate: entry.canView && entry.canUpdate, canDelete: entry.canView && entry.canDelete });
    }
    const result = await this.tenantContext.run({ schoolId, userId: actorUserId, role: 'PLATFORM_ADMIN' }, async () => {
      const saved = await this.prisma.$transaction(async (transaction) => {
        const permissions = [];
        for (const entry of uniqueEntries.values()) {
          permissions.push(await transaction.rolePermission.upsert({
            where: { schoolId_role_module: { schoolId, role: entry.role, module: entry.module } },
            create: { ...entry, schoolId },
            update: { canView: entry.canView, canCreate: entry.canCreate, canUpdate: entry.canUpdate, canDelete: entry.canDelete },
          }));
        }
        await transaction.auditLog.create({ data: { action: 'ROLE_PERMISSIONS_UPDATED_BY_PLATFORM', entityType: 'RolePermission', details: { entryCount: permissions.length } } });
        return permissions;
      });
      return saved;
    });
    await this.prisma.platformAuditLog.create({ data: { actorUserId, action: 'PLATFORM_SCHOOL_PERMISSIONS_UPDATED', entityType: 'School', entityId: schoolId, details: { entryCount: result.length } } });
    return result;
  }

  async listPlatformSchoolUsers(schoolId: string) {
    await this.requirePlatformSchool(schoolId);
    return this.tenantContext.run({ schoolId }, async () => {
      const memberships = await this.prisma.schoolMembership.findMany({
        include: { user: { select: { id: true, fullName: true, email: true, phone: true, isActive: true, createdAt: true, updatedAt: true } } },
        orderBy: [{ user: { fullName: 'asc' } }],
      });
      return memberships.map((membership) => ({ ...membership.user, role: membership.role, isActive: membership.isActive && membership.user.isActive, membershipId: membership.id }));
    });
  }

  async updatePlatformSchoolUser(schoolId: string, userId: string, dto: UpdateUserRoleDto, actorUserId: string) {
    await this.requirePlatformSchool(schoolId);
    const updated = await this.tenantContext.run({ schoolId, userId: actorUserId, role: 'PLATFORM_ADMIN' }, async () => {
      const membership = await this.prisma.schoolMembership.update({
        where: { schoolId_userId: { schoolId, userId } },
        data: { ...(dto.role !== undefined ? { role: dto.role } : {}), ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}) },
        include: { user: { select: { id: true, fullName: true, email: true, phone: true, isActive: true, createdAt: true, updatedAt: true } } },
      });
      await this.prisma.auditLog.create({ data: { action: 'USER_ACCESS_UPDATED_BY_PLATFORM', entityType: 'SchoolMembership', entityId: membership.id, details: { ...dto, userId } } });
      return { ...membership.user, role: membership.role, isActive: membership.isActive && membership.user.isActive, membershipId: membership.id };
    });
    await this.prisma.platformAuditLog.create({ data: { actorUserId, action: 'PLATFORM_SCHOOL_USER_UPDATED', entityType: 'User', entityId: userId, details: { schoolId, ...dto } } });
    return updated;
  }

  private async requirePlatformSchool(schoolId: string) {
    const school = await this.prisma.school.findUnique({ where: { id: schoolId }, select: { id: true } });
    if (!school) throw new NotFoundException('Établissement introuvable.');
    return school;
  }

  private async ensureDefaultSchoolPermissions(schoolId: string) {
    const permissions = Object.values(UserRole).flatMap((role) =>
      ADMIN_MODULES.map((module) => ({
        schoolId,
        role,
        module,
        canView: true,
        canCreate: true,
        canUpdate: true,
        canDelete: true,
      })),
    );

    await this.prisma.rolePermission.createMany({
      data: permissions,
      skipDuplicates: true,
    });
  }

  async getCurrentUser(userId: string, schoolId: string) {
    const membership = await this.prisma.schoolMembership.findUnique({
      where: { schoolId_userId: { schoolId, userId } },
      include: { school: true, user: true },
    });
    if (!membership || !membership.isActive || !membership.school.isActive || !membership.user.isActive) {
      throw new UnauthorizedException('Cette session ou adhésion n’est plus active.');
    }
    return {
      user: { id: membership.user.id, fullName: membership.user.fullName, email: membership.user.email, role: membership.role },
      school: { id: membership.school.id, name: membership.school.name, slug: membership.school.slug },
    };
  }

  async hasPermission(schoolId: string, role: UserRole, module: string, action: 'canView' | 'canCreate' | 'canUpdate' | 'canDelete') {
    if (role === UserRole.ADMIN) return true;
    const permission = await this.prisma.rolePermission.findUnique({
      where: { schoolId_role_module: { schoolId, role, module } },
      select: { canView: true, canCreate: true, canUpdate: true, canDelete: true },
    });
    return permission?.[action] ?? false;
  }

  async getCurrentRolePermissions(userId: string, schoolId: string) {
    const membership = await this.prisma.schoolMembership.findUnique({
      where: { schoolId_userId: { schoolId, userId } },
      select: { role: true },
    });
    if (!membership) throw new UnauthorizedException('Aucun accès actif à cet établissement.');
    const rolePermissions = await this.prisma.rolePermission.findMany({
      where: { schoolId, role: membership.role },
      select: { module: true, canView: true, canCreate: true, canUpdate: true, canDelete: true },
    });
    const savedByModule = new Map(rolePermissions.map((permission) => [permission.module, permission]));
    return {
      role: membership.role,
      permissions: ADMIN_MODULES.map((module) => {
      const saved = savedByModule.get(module);
      const isAdministrator = membership.role === UserRole.ADMIN;
      return {
        module,
        canView: isAdministrator || (saved?.canView ?? false),
        canCreate: isAdministrator || (saved?.canCreate ?? false),
        canUpdate: isAdministrator || (saved?.canUpdate ?? false),
        canDelete: isAdministrator || (saved?.canDelete ?? false),
      };
      }),
    };
  }

  async listMySchools(userId: string) {
    const memberships = await this.prisma.schoolMembership.findMany({
      where: { userId, isActive: true, school: { isActive: true } },
      include: { school: true },
      orderBy: { createdAt: 'asc' },
    });
    return memberships.map(({ school, role }) => ({ id: school.id, name: school.name, slug: school.slug, role }));
  }

  async switchSchool(userId: string, schoolId: string) {
    const membership = await this.prisma.schoolMembership.findUnique({
      where: { schoolId_userId: { schoolId, userId } },
      include: { school: true, user: true },
    });
    if (!membership?.isActive || !membership.school.isActive || !membership.user.isActive) {
      throw new UnauthorizedException('Ce compte n’a pas accès à cette école.');
    }
    return this.createSession(membership.user, membership.school, membership.role);
  }

  async validateMembership(userId: string, schoolId: string) {
    const membership = await this.prisma.schoolMembership.findUnique({
      where: { schoolId_userId: { schoolId, userId } },
      include: { school: true, user: true },
    });
    if (!membership || !membership.isActive || !membership.school.isActive || !membership.user.isActive) return null;
    return { schoolId, userId, role: membership.role };
  }

  async validateParentSession(userId: string, schoolId: string, guardianId: string) {
    const school = await this.prisma.school.findUnique({ where: { id: schoolId } });
    if (!school?.isActive) return null;
    return this.tenantContext.run({ schoolId, userId, role: 'PARENT' }, async () => {
      const [account, membership] = await Promise.all([
        this.prisma.parentAccount.findUnique({
          where: { userId },
          include: { user: true, guardian: { include: { students: { where: { schoolId, student: { isActive: true, schoolId } }, select: { studentId: true } } } } },
        }),
        this.prisma.schoolMembership.findUnique({ where: { schoolId_userId: { schoolId, userId } } }),
      ]);
      if (!account || account.schoolId !== schoolId || account.guardianId !== guardianId || account.guardian.schoolId !== schoolId || !account.guardian.isActive) return null;
      if (!account.user.isActive || account.user.role !== UserRole.PARENT || !membership?.isActive || membership.role !== UserRole.PARENT) return null;
      if (!account.guardian.students.length) return null;
      return { schoolId, userId, role: UserRole.PARENT, guardianId, parentAccountId: account.id };
    });
  }

  private async createSession(user: { id: string; fullName: string; email: string | null }, school: { id: string; name: string; slug: string }, role: UserRole) {
    const accessToken = await this.jwt.signAsync({ sub: user.id, schoolId: school.id, role });
    return {
      accessToken,
      user: { id: user.id, fullName: user.fullName, email: user.email, role },
      school: { id: school.id, name: school.name, slug: school.slug },
    };
  }

  private async createPlatformSession(user: { id: string; fullName: string; email: string | null }) {
    const accessToken = await this.jwt.signAsync({ sub: user.id, tokenType: 'PLATFORM_ADMIN' });
    return { accessToken, user: { id: user.id, fullName: user.fullName, email: user.email, role: 'PLATFORM_ADMIN' as const } };
  }

  private slugify(value: string) {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 45) || 'ecole';
  }
}