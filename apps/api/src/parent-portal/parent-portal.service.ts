import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PortalNoticeStatus, UserRole } from '@prisma/client';
import { compare, hash } from 'bcryptjs';
import { PrismaService } from '../database/prisma.service';
import { TenantContextService } from '../database/tenant-context.service';
import {
  CreateParentAccountDto,
  CreatePortalNoticeDto,
  LinkParentAccountDto,
  ParentPortalLoginDto,
  UpdatePortalNoticeDto,
  UpdatePortalSettingsDto,
} from './parent-portal.dto';

@Injectable()
export class ParentPortalService {
  constructor(private readonly prisma: PrismaService, private readonly tenantContext: TenantContextService, private readonly jwt: JwtService) {}

  private schoolId() { return this.tenantContext.schoolId()!; }

  getSettings() {
    const schoolId = this.schoolId();
    return this.prisma.portalSettings.upsert({ where: { schoolId }, create: { schoolId }, update: {} });
  }

  async loginParent(dto: ParentPortalLoginDto) {
    const school = await this.prisma.school.findUnique({ where: { slug: dto.schoolSlug.trim().toLowerCase() } });
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.trim().toLowerCase() } });
    if (!school?.isActive || !user?.isActive || user.role !== UserRole.PARENT || !(await compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('École ou identifiants parent incorrects.');
    }

    const membership = await this.prisma.schoolMembership.findUnique({ where: { schoolId_userId: { schoolId: school.id, userId: user.id } } });
    const account = await this.tenantContext.run({ schoolId: school.id, userId: user.id, role: UserRole.PARENT }, async () =>
      this.prisma.parentAccount.findUnique({
        where: { userId: user.id },
        include: { guardian: { include: { students: { where: { schoolId: school.id, student: { isActive: true, schoolId: school.id } }, select: { studentId: true } } } } },
      }),
    );
    if (!membership?.isActive || membership.role !== UserRole.PARENT || !account || account.schoolId !== school.id || account.guardian.schoolId !== school.id || !account.guardian.isActive || !account.guardian.students.length) {
      throw new UnauthorizedException('École ou identifiants parent incorrects.');
    }

    const settings = await this.tenantContext.run({ schoolId: school.id, userId: user.id, role: UserRole.PARENT }, async () => await this.getSettings());
    await this.tenantContext.run({ schoolId: school.id, userId: user.id, role: UserRole.PARENT }, async () => {
      await this.prisma.auditLog.create({ data: { action: 'PARENT_SIGNED_IN', entityType: 'ParentAccount', entityId: account.id } });
    });
    const accessToken = await this.jwt.signAsync({ sub: user.id, schoolId: school.id, role: UserRole.PARENT, tokenType: 'PARENT', guardianId: account.guardianId, parentAccountId: account.id });
    return {
      accessToken,
      user: { id: user.id, fullName: user.fullName, email: user.email, role: UserRole.PARENT },
      school: { id: school.id, name: school.name, slug: school.slug },
      guardian: { id: account.guardian.id, firstName: account.guardian.firstName, lastName: account.guardian.lastName, childCount: account.guardian.students.length },
      portalEnabled: settings.enabled,
    };
  }

  async getParentSession(userId: string, schoolId: string, guardianId: string) {
    const account = await this.prisma.parentAccount.findUnique({
      where: { userId },
      include: {
        user: { select: { id: true, fullName: true, email: true } },
        guardian: { include: { students: { where: { schoolId, student: { isActive: true, schoolId } }, select: { studentId: true } } } },
      },
    });
    const school = await this.prisma.school.findUnique({ where: { id: schoolId } });
    const settings = await this.getSettings();
    if (!account || !school || account.schoolId !== schoolId || account.guardianId !== guardianId || account.guardian.schoolId !== schoolId) {
      throw new UnauthorizedException('Cette session parent n’est plus valide.');
    }
    return {
      user: account.user,
      school: { id: school.id, name: school.name, slug: school.slug },
      guardian: { id: account.guardian.id, firstName: account.guardian.firstName, lastName: account.guardian.lastName, childCount: account.guardian.students.length },
      portalEnabled: settings.enabled,
    };
  }

  async createParentAccount(dto: CreateParentAccountDto) {
    const guardian = await this.prisma.guardian.findFirst({
      where: { id: dto.guardianId, isActive: true },
      include: { students: { where: { schoolId: this.schoolId(), student: { isActive: true, schoolId: this.schoolId() } } }, portalAccount: true },
    });
    if (!guardian) throw new BadRequestException('Le responsable est introuvable ou archivé.');
    if (!guardian.students.length) throw new BadRequestException('Le responsable doit être lié à au moins un élève actif.');
    if (guardian.portalAccount) throw new ConflictException('Ce responsable possède déjà un compte parent.');

    const email = dto.email.trim().toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email } })) throw new ConflictException('Cette adresse courriel est déjà utilisée.');
    const schoolId = this.schoolId();
    const passwordHash = await hash(dto.password, 12);
    return this.prisma.$transaction(async (transaction) => {
      const user = await transaction.user.create({ data: { fullName: dto.fullName.trim(), email, passwordHash, role: UserRole.PARENT } });
      await transaction.schoolMembership.create({ data: { schoolId, userId: user.id, role: UserRole.PARENT } });
      const account = await transaction.parentAccount.create({
        data: { schoolId, guardianId: guardian.id, userId: user.id },
        include: { guardian: true, user: { select: { id: true, fullName: true, email: true, role: true } } },
      });
      await transaction.auditLog.create({ data: { action: 'PARENT_ACCOUNT_CREATED', entityType: 'ParentAccount', entityId: account.id, details: { guardianId: guardian.id, userId: user.id } } });
      return account;
    });
  }

  async updateSettings(dto: UpdatePortalSettingsDto) {
    if (dto.enabled === true) {
      throw new BadRequestException('Le portail ne peut pas être activé avant le déploiement des vues de contenu filtrées par responsable.');
    }
    const data = { ...dto };
    const schoolId = this.schoolId();
    const settings = await this.prisma.portalSettings.upsert({
      where: { schoolId },
      create: { schoolId, ...data },
      update: data,
    });
        await this.prisma.auditLog.create({ data: { action: 'PARENT_PORTAL_SETTINGS_UPDATED', entityType: 'PortalSettings', entityId: settings.id, details: { changedFields: Object.keys(dto), enabled: settings.enabled } } });
    return settings;
  }

  async listAccounts() {
    const [guardians, parentUsers] = await Promise.all([
        this.prisma.guardian.findMany({
        include: {
          students: { where: { student: { isActive: true } }, include: { student: true } },
          portalAccount: { include: { user: { select: { id: true, fullName: true, email: true, role: true, isActive: true } } } },
        },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      }),
      this.prisma.schoolMembership.findMany({
        where: { schoolId: this.schoolId(), role: UserRole.PARENT, isActive: true, user: { isActive: true } },
        include: { user: { select: { id: true, fullName: true, email: true, phone: true, isActive: true } } },
        orderBy: { user: { fullName: 'asc' } },
      }),
    ]);
    return { guardians, parentUsers: parentUsers.map((membership) => membership.user) };
  }

  async listCommunicationRecipients() {
    const guardians = await this.prisma.guardian.findMany({
      where: { isActive: true, students: { some: { student: { isActive: true } } } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        students: {
          where: { student: { isActive: true } },
          select: { student: { select: { id: true, firstName: true, lastName: true } } },
        },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
    return guardians.map(({ students, ...guardian }) => ({
      ...guardian,
      studentCount: students.length,
      students: students.map(({ student }) => student),
    }));
  }

  async linkAccount(dto: LinkParentAccountDto) {
    const [guardian, user] = await Promise.all([
      this.prisma.guardian.findUnique({ where: { id: dto.guardianId }, include: { students: { where: { student: { isActive: true } } } } }),
      this.prisma.schoolMembership.findUnique({ where: { schoolId_userId: { schoolId: this.schoolId(), userId: dto.userId } }, include: { user: true } }),
    ]);
    if (!guardian?.isActive) throw new BadRequestException('Le responsable est introuvable ou archivé.');
    if (!guardian.students.length) throw new BadRequestException('Le responsable doit être lié à au moins un élève actif.');
    if (!user || !user.isActive || !user.user.isActive || user.role !== UserRole.PARENT) throw new BadRequestException('Sélectionnez un compte parent actif dans cette école.');

    const link = await this.prisma.parentAccount.create({
      data: { schoolId: this.schoolId(), guardianId: dto.guardianId, userId: dto.userId },
      include: { guardian: true, user: { select: { id: true, fullName: true, email: true, role: true } } },
    });
    await this.prisma.auditLog.create({ data: { action: 'PARENT_PORTAL_ACCOUNT_LINKED', entityType: 'ParentAccount', entityId: link.id, details: { guardianId: dto.guardianId, userId: dto.userId } } });
    return link;
  }

  async unlinkAccount(guardianId: string) {
    const link = await this.prisma.parentAccount.findUnique({ where: { guardianId } });
    if (!link) throw new BadRequestException('Aucun compte portail associé à ce responsable.');
    await this.prisma.parentAccount.delete({ where: { id: link.id } });
    await this.prisma.auditLog.create({ data: { action: 'PARENT_PORTAL_ACCOUNT_UNLINKED', entityType: 'ParentAccount', entityId: link.id, details: { guardianId } } });
    return { success: true };
  }

  listNotices() {
    return this.prisma.portalNotice.findMany({
      include: { guardian: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createNotice(dto: CreatePortalNoticeDto) {
    if (dto.guardianId) {
      const guardian = await this.prisma.guardian.findFirst({ where: { id: dto.guardianId, isActive: true } });
      if (!guardian) throw new BadRequestException('Le responsable sélectionné est introuvable ou archivé.');
    }
    const notice = await this.prisma.portalNotice.create({
      data: { title: dto.title.trim(), body: dto.body.trim(), guardianId: dto.guardianId ?? null },
      include: { guardian: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } } },
    });
    await this.prisma.auditLog.create({ data: { action: 'PARENT_PORTAL_NOTICE_CREATED', entityType: 'PortalNotice', entityId: notice.id, details: { guardianId: notice.guardianId, status: notice.status } } });
    return notice;
  }

  async updateNotice(id: string, dto: UpdatePortalNoticeDto) {
    const existing = await this.prisma.portalNotice.findUnique({ where: { id } });
    if (!existing) throw new BadRequestException('Message introuvable.');
    if (existing.status === PortalNoticeStatus.ARCHIVED) throw new BadRequestException('Un message archivé ne peut pas être modifié.');
    const notice = await this.prisma.portalNotice.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.body !== undefined ? { body: dto.body.trim() } : {}),
        ...(dto.status !== undefined ? { status: dto.status, approvedAt: dto.status === PortalNoticeStatus.READY ? new Date() : null } : {}),
      },
      include: { guardian: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } } },
    });
    await this.prisma.auditLog.create({ data: { action: dto.status === PortalNoticeStatus.READY ? 'PARENT_PORTAL_NOTICE_APPROVED' : 'PARENT_PORTAL_NOTICE_UPDATED', entityType: 'PortalNotice', entityId: id, details: { changedFields: Object.keys(dto), status: notice.status } } });
    return notice;
  }
}