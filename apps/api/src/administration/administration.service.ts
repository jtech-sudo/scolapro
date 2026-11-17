import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { hash } from 'bcryptjs';
import { PrismaService } from '../database/prisma.service';
import { TenantContextService } from '../database/tenant-context.service';
import {
  ADMIN_MODULES,
  AdminModuleKey,
  RolePermissionEntryDto,
  UpdateSchoolProfileDto,
  UpdateUserRoleDto,
} from './administration.dto';

@Injectable()
export class AdministrationService {
  constructor(private readonly prisma: PrismaService, private readonly tenantContext: TenantContextService) {}

  private schoolId() {
    return this.tenantContext.schoolId()!;
  }

  getSchoolProfile() {
    const schoolId = this.schoolId();
    return this.prisma.schoolProfile.upsert({ where: { schoolId }, create: { schoolId }, update: {} });
  }

  async updateSchoolProfile(dto: UpdateSchoolProfileDto) {
    const schoolId = this.schoolId();
    const profile = await this.prisma.schoolProfile.upsert({
      where: { schoolId },
      create: { schoolId, ...this.profileData(dto) },
      update: this.profileData(dto),
    });
    await this.prisma.auditLog.create({
      data: { action: 'SCHOOL_PROFILE_UPDATED', entityType: 'SchoolProfile', entityId: profile.id, details: { changedFields: Object.keys(dto) } },
    });
    return profile;
  }

  async getRolePermissions() {
    const saved = await this.prisma.rolePermission.findMany({ orderBy: [{ role: 'asc' }, { module: 'asc' }] });
    const byKey = new Map(saved.map((permission) => [`${permission.role}:${permission.module}`, permission]));
    return Object.values(UserRole).flatMap((role) => ADMIN_MODULES.map((module) => byKey.get(`${role}:${module}`) ?? {
      id: null,
      role,
      module,
      canView: role === UserRole.ADMIN,
      canCreate: role === UserRole.ADMIN,
      canUpdate: role === UserRole.ADMIN,
      canDelete: role === UserRole.ADMIN,
      isDefault: true,
    }));
  }

  async saveRolePermissions(entries: RolePermissionEntryDto[]) {
    const validModules = new Set<string>(ADMIN_MODULES);
    const uniqueEntries = new Map<string, RolePermissionEntryDto>();
    for (const entry of entries) {
      if (!validModules.has(entry.module)) continue;
      uniqueEntries.set(`${entry.role}:${entry.module}`, entry.role === UserRole.ADMIN
        ? { ...entry, canView: true, canCreate: true, canUpdate: true, canDelete: true }
        : { ...entry, canCreate: entry.canView && entry.canCreate, canUpdate: entry.canView && entry.canUpdate, canDelete: entry.canView && entry.canDelete });
    }

    const permissions = await this.prisma.$transaction(async (transaction) => {
      const results = [];
      for (const entry of uniqueEntries.values()) {
        results.push(await transaction.rolePermission.upsert({
          where: { schoolId_role_module: { schoolId: this.schoolId(), role: entry.role, module: entry.module } },
          create: { ...entry, schoolId: this.schoolId() },
          update: { canView: entry.canView, canCreate: entry.canCreate, canUpdate: entry.canUpdate, canDelete: entry.canDelete },
        }));
      }
      await transaction.auditLog.create({ data: { action: 'ROLE_PERMISSIONS_UPDATED', entityType: 'RolePermission', details: { entryCount: results.length } } });
      return results;
    });
    return permissions;
  }

  listUsers() {
    return this.prisma.schoolMembership.findMany({
      where: { schoolId: this.schoolId() },
      include: { user: { select: { id: true, fullName: true, email: true, phone: true, isActive: true, createdAt: true, updatedAt: true } } },
      orderBy: [{ user: { fullName: 'asc' } }],
    }).then((memberships) => memberships.map((membership) => ({ ...membership.user, role: membership.role, isActive: membership.isActive && membership.user.isActive, membershipId: membership.id })));
  }

  async updateUser(id: string, dto: UpdateUserRoleDto) {
    const membership = await this.prisma.schoolMembership.update({
      where: { schoolId_userId: { schoolId: this.schoolId(), userId: id } },
      data: { ...(dto.role !== undefined ? { role: dto.role } : {}), ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}) },
      include: { user: { select: { id: true, fullName: true, email: true, phone: true, isActive: true, createdAt: true, updatedAt: true } } },
    });
    await this.prisma.auditLog.create({
      data: { action: 'USER_ACCESS_UPDATED', entityType: 'SchoolMembership', entityId: membership.id, details: { ...dto, userId: id } },
    });
    return { ...membership.user, role: membership.role, isActive: membership.isActive && membership.user.isActive, membershipId: membership.id };
  }

  async resetUserPassword(id: string, password: string) {
    const context = this.tenantContext.current();
    if (context?.role !== UserRole.ADMIN && context?.role !== UserRole.DIRECTOR) {
      throw new ForbiddenException('Seuls l’administrateur ou la direction peuvent réinitialiser un mot de passe.');
    }
    const schoolId = this.schoolId();
    const membership = await this.prisma.schoolMembership.findUnique({
      where: { schoolId_userId: { schoolId, userId: id } },
      select: { id: true },
    });
    if (!membership) throw new NotFoundException('Ce compte ne fait pas partie de cet établissement.');

    const passwordHash = await hash(password, 12);
    await this.prisma.user.update({ where: { id }, data: { passwordHash } });
    await this.prisma.auditLog.create({
      data: { action: 'USER_PASSWORD_RESET', entityType: 'User', entityId: id, details: { membershipId: membership.id } },
    });
    return { success: true };
  }

  getSecurityAuditLogs() {
    return this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { id: true, action: true, entityType: true, entityId: true, details: true, createdAt: true, actorUserId: true },
    });
  }

  getArchivedStudents() {
    return this.prisma.student.findMany({
      where: { isActive: false },
      orderBy: { updatedAt: 'desc' },
      take: 100,
      select: { id: true, matricule: true, firstName: true, lastName: true, updatedAt: true },
    });
  }

  async restoreArchivedStudent(id: string) {
    const student = await this.prisma.student.findUnique({ where: { id } });
    if (!student || student.isActive) throw new NotFoundException('Dossier archivé introuvable.');
    const restored = await this.prisma.student.update({ where: { id }, data: { isActive: true } });
    await this.prisma.auditLog.create({
      data: { action: 'STUDENT_RESTORED_FROM_ARCHIVE', entityType: 'Student', entityId: id, details: { matricule: student.matricule } },
    });
    return { id: restored.id, firstName: restored.firstName, lastName: restored.lastName, isActive: restored.isActive };
  }

  private profileData(dto: UpdateSchoolProfileDto) {
    return {
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
  }
}