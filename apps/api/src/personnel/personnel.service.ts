import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { Prisma, StaffLeaveStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CreateStaffLeaveDto, CreateStaffMemberDto, ReviewStaffLeaveDto, UpdateStaffMemberDto } from './personnel.dto';

const staffInclude = {
  leaves: { orderBy: { startsOn: 'desc' as const }, take: 100 },
} satisfies Prisma.StaffMemberInclude;

@Injectable()
export class PersonnelService {
  constructor(private readonly prisma: PrismaService) {}

  listRecords() {
    return this.prisma.staffMember.findMany({
      include: staffInclude,
      orderBy: [{ isActive: 'desc' }, { lastName: 'asc' }, { firstName: 'asc' }],
      take: 500,
    });
  }

  async createRecord(dto: CreateStaffMemberDto) {
    const employeeNumber = dto.employeeNumber?.trim() || `EMP-${randomBytes(3).toString('hex').toUpperCase()}`;
    const record = await this.prisma.staffMember.create({
      data: {
        employeeNumber,
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        position: dto.position.trim(),
        phone: dto.phone?.trim() || null,
        email: dto.email?.trim().toLowerCase() || null,
        contractType: dto.contractType?.trim() || null,
        hiredAt: dto.hiredAt ? new Date(dto.hiredAt) : null,
      },
      include: staffInclude,
    });
    await this.audit('STAFF_MEMBER_CREATED', record.id, { employeeNumber, position: record.position });
    return record;
  }

  async updateRecord(id: string, dto: UpdateStaffMemberDto) {
    const existing = await this.prisma.staffMember.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Dossier du personnel introuvable.');
    const data: Prisma.StaffMemberUpdateInput = {
      ...(dto.employeeNumber !== undefined ? { employeeNumber: dto.employeeNumber.trim() } : {}),
      ...(dto.firstName !== undefined ? { firstName: dto.firstName.trim() } : {}),
      ...(dto.lastName !== undefined ? { lastName: dto.lastName.trim() } : {}),
      ...(dto.position !== undefined ? { position: dto.position.trim() } : {}),
      ...(dto.phone !== undefined ? { phone: dto.phone?.trim() || null } : {}),
      ...(dto.email !== undefined ? { email: dto.email?.trim().toLowerCase() || null } : {}),
      ...(dto.contractType !== undefined ? { contractType: dto.contractType?.trim() || null } : {}),
      ...(dto.hiredAt !== undefined ? { hiredAt: dto.hiredAt ? new Date(dto.hiredAt) : null } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
    };
    const record = await this.prisma.staffMember.update({ where: { id }, data, include: staffInclude });
    await this.audit(dto.isActive === false ? 'STAFF_MEMBER_ARCHIVED' : 'STAFF_MEMBER_UPDATED', id, { changedFields: Object.keys(dto) });
    return record;
  }

  async createLeave(staffId: string, dto: CreateStaffLeaveDto) {
    const staff = await this.prisma.staffMember.findFirst({ where: { id: staffId, isActive: true } });
    if (!staff) throw new NotFoundException('Membre du personnel actif introuvable.');
    const startsOn = new Date(dto.startsOn);
    const endsOn = new Date(dto.endsOn);
    if (Number.isNaN(startsOn.getTime()) || Number.isNaN(endsOn.getTime()) || startsOn > endsOn) {
      throw new BadRequestException('La date de fin du congé doit être égale ou postérieure à la date de début.');
    }
    const conflictingLeave = await this.prisma.staffLeave.findFirst({
      where: {
        staffId,
        status: { in: [StaffLeaveStatus.PENDING, StaffLeaveStatus.APPROVED] },
        startsOn: { lte: endsOn },
        endsOn: { gte: startsOn },
      },
    });
    if (conflictingLeave) throw new BadRequestException('Une demande en attente ou un congé approuvé existe déjà sur cette période.');

    const leave = await this.prisma.staffLeave.create({
      data: { staffId, startsOn, endsOn, reason: dto.reason?.trim() || null },
      include: { staff: { select: { id: true, employeeNumber: true, firstName: true, lastName: true, position: true } } },
    });
    await this.audit('STAFF_LEAVE_REQUESTED', leave.id, { staffId, startsOn: dto.startsOn, endsOn: dto.endsOn });
    return leave;
  }

  async reviewLeave(id: string, dto: ReviewStaffLeaveDto) {
    if (dto.status === StaffLeaveStatus.PENDING) throw new BadRequestException('Une demande examinée ne peut pas être remise en attente.');
    return this.prisma.$transaction(async (transaction) => {
      const leave = await transaction.staffLeave.findUnique({ where: { id } });
      if (!leave) throw new NotFoundException('Demande de congé introuvable.');
      if (leave.status !== StaffLeaveStatus.PENDING) throw new BadRequestException('Cette demande de congé a déjà été examinée.');

      const updatedCount = await transaction.staffLeave.updateMany({
        where: { id, status: StaffLeaveStatus.PENDING },
        data: { status: dto.status, reviewedAt: new Date() },
      });
      if (updatedCount.count !== 1) throw new BadRequestException('Cette demande de congé vient d’être examinée.');
      const updated = await transaction.staffLeave.findUniqueOrThrow({
        where: { id },
        include: { staff: { select: { id: true, employeeNumber: true, firstName: true, lastName: true, position: true } } },
      });
      await transaction.auditLog.create({
        data: {
          action: dto.status === StaffLeaveStatus.APPROVED ? 'STAFF_LEAVE_APPROVED' : 'STAFF_LEAVE_REJECTED',
          entityType: 'StaffMember',
          entityId: id,
          details: { staffId: leave.staffId },
        },
      });
      return updated;
    });
  }

  private audit(action: string, entityId: string, details: Prisma.InputJsonObject) {
    return this.prisma.auditLog.create({ data: { action, entityType: 'StaffMember', entityId, details } });
  }
}
