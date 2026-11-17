import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import {
  CreateGuardianDto,
  CreateSubjectDto,
  CreateTeacherDto,
  CreateTeachingAssignmentDto,
  LinkGuardianDto,
  UpdateGuardianDto,
  UpdateSubjectDto,
  UpdateTeacherDto,
} from './organization.dto';

@Injectable()
export class OrganizationService {
  constructor(private readonly prisma: PrismaService) {}

  listGuardians() {
    return this.prisma.guardian.findMany({
      include: { students: { include: { student: true }, orderBy: { student: { lastName: 'asc' } } } },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
  }

  createGuardian(dto: CreateGuardianDto) {
    const data: Prisma.GuardianCreateInput = {
      firstName: dto.firstName.trim(),
      lastName: dto.lastName.trim(),
      ...(dto.phone ? { phone: dto.phone.trim() } : {}),
      ...(dto.email ? { email: dto.email.trim().toLowerCase() } : {}),
      ...(dto.address ? { address: dto.address.trim() } : {}),
      ...(dto.occupation ? { occupation: dto.occupation.trim() } : {}),
    };
    return this.prisma.$transaction(async (transaction) => {
      const guardian = await transaction.guardian.create({ data });
      await transaction.auditLog.create({ data: { action: 'GUARDIAN_CREATED', entityType: 'Guardian', entityId: guardian.id } });
      return guardian;
    });
  }

  updateGuardian(id: string, dto: UpdateGuardianDto) {
    const data: Prisma.GuardianUpdateInput = {
      ...(dto.firstName !== undefined ? { firstName: dto.firstName.trim() } : {}),
      ...(dto.lastName !== undefined ? { lastName: dto.lastName.trim() } : {}),
      ...(dto.phone !== undefined ? { phone: dto.phone?.trim() || null } : {}),
      ...(dto.email !== undefined ? { email: dto.email?.trim().toLowerCase() || null } : {}),
      ...(dto.address !== undefined ? { address: dto.address?.trim() || null } : {}),
      ...(dto.occupation !== undefined ? { occupation: dto.occupation?.trim() || null } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
    };
    return this.prisma.$transaction(async (transaction) => {
      const guardian = await transaction.guardian.update({ where: { id }, data, include: { students: { include: { student: true } } } });
      await transaction.auditLog.create({ data: { action: 'GUARDIAN_UPDATED', entityType: 'Guardian', entityId: id, details: { changedFields: Object.keys(data) } } });
      return guardian;
    });
  }

  linkGuardian(guardianId: string, dto: LinkGuardianDto) {
    return this.prisma.$transaction(async (transaction) => {
      if (dto.isPrimary) {
        await transaction.studentGuardian.updateMany({ where: { studentId: dto.studentId }, data: { isPrimary: false } });
      }
      const link = await transaction.studentGuardian.create({
        data: { guardianId, studentId: dto.studentId, relationship: dto.relationship.trim(), isPrimary: dto.isPrimary ?? false },
        include: { student: true, guardian: true },
      });
      await transaction.auditLog.create({ data: { action: 'GUARDIAN_LINKED_TO_STUDENT', entityType: 'StudentGuardian', entityId: `${dto.studentId}:${guardianId}`, details: { relationship: link.relationship, isPrimary: link.isPrimary } } });
      return link;
    });
  }

  async unlinkGuardian(guardianId: string, studentId: string) {
    await this.prisma.studentGuardian.delete({ where: { studentId_guardianId: { studentId, guardianId } } });
    await this.prisma.auditLog.create({ data: { action: 'GUARDIAN_UNLINKED_FROM_STUDENT', entityType: 'StudentGuardian', entityId: `${studentId}:${guardianId}` } });
    return { success: true };
  }

  listTeachers() {
    return this.prisma.teacher.findMany({
      include: { _count: { select: { assignments: true } } },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
  }

  createTeacher(dto: CreateTeacherDto) {
    const employeeNumber = dto.employeeNumber?.trim() || `ENS-${randomBytes(3).toString('hex').toUpperCase()}`;
    return this.prisma.$transaction(async (transaction) => {
      const teacher = await transaction.teacher.create({
        data: {
          employeeNumber,
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          ...(dto.phone ? { phone: dto.phone.trim() } : {}),
          ...(dto.email ? { email: dto.email.trim().toLowerCase() } : {}),
          ...(dto.specialty ? { specialty: dto.specialty.trim() } : {}),
        },
      });
      await transaction.auditLog.create({ data: { action: 'TEACHER_CREATED', entityType: 'Teacher', entityId: teacher.id, details: { employeeNumber } } });
      return teacher;
    });
  }

  updateTeacher(id: string, dto: UpdateTeacherDto) {
    const data: Prisma.TeacherUpdateInput = {
      ...(dto.firstName !== undefined ? { firstName: dto.firstName.trim() } : {}),
      ...(dto.lastName !== undefined ? { lastName: dto.lastName.trim() } : {}),
      ...(dto.phone !== undefined ? { phone: dto.phone?.trim() || null } : {}),
      ...(dto.email !== undefined ? { email: dto.email?.trim().toLowerCase() || null } : {}),
      ...(dto.specialty !== undefined ? { specialty: dto.specialty?.trim() || null } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
    };
    return this.prisma.$transaction(async (transaction) => {
      const teacher = await transaction.teacher.update({ where: { id }, data, include: { _count: { select: { assignments: true } } } });
      await transaction.auditLog.create({ data: { action: 'TEACHER_UPDATED', entityType: 'Teacher', entityId: id, details: { changedFields: Object.keys(data) } } });
      return teacher;
    });
  }

  listSubjects() {
    return this.prisma.subject.findMany({
      include: { _count: { select: { assignments: true } } },
      orderBy: { name: 'asc' },
    });
  }

  createSubject(dto: CreateSubjectDto) {
    return this.prisma.$transaction(async (transaction) => {
      const subject = await transaction.subject.create({ data: { name: dto.name.trim(), code: dto.code.trim().toUpperCase() } });
      await transaction.auditLog.create({ data: { action: 'SUBJECT_CREATED', entityType: 'Subject', entityId: subject.id, details: { code: subject.code } } });
      return subject;
    });
  }

  updateSubject(id: string, dto: UpdateSubjectDto) {
    const data: Prisma.SubjectUpdateInput = {
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.code !== undefined ? { code: dto.code.trim().toUpperCase() } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
    };
    return this.prisma.$transaction(async (transaction) => {
      const subject = await transaction.subject.update({ where: { id }, data, include: { _count: { select: { assignments: true } } } });
      await transaction.auditLog.create({ data: { action: 'SUBJECT_UPDATED', entityType: 'Subject', entityId: id, details: { changedFields: Object.keys(data) } } });
      return subject;
    });
  }

  listTeachingAssignments(schoolYearId?: string) {
    return this.prisma.teachingAssignment.findMany({
      where: schoolYearId ? { class: { schoolYearId } } : {},
      include: { class: { include: { level: true, schoolYear: true } }, subject: true, teacher: true },
      orderBy: [{ class: { level: { sortOrder: 'asc' } } }, { subject: { name: 'asc' } }],
    });
  }

  createTeachingAssignment(dto: CreateTeachingAssignmentDto) {
    return this.prisma.$transaction(async (transaction) => {
      const assignment = await transaction.teachingAssignment.create({
        data: { classId: dto.classId, subjectId: dto.subjectId, teacherId: dto.teacherId },
        include: { class: { include: { level: true, schoolYear: true } }, subject: true, teacher: true },
      });
      await transaction.auditLog.create({ data: { action: 'TEACHING_ASSIGNMENT_CREATED', entityType: 'TeachingAssignment', entityId: assignment.id, details: { classId: dto.classId, subjectId: dto.subjectId, teacherId: dto.teacherId } } });
      return assignment;
    });
  }

  async removeTeachingAssignment(id: string) {
    await this.prisma.teachingAssignment.delete({ where: { id } });
    await this.prisma.auditLog.create({ data: { action: 'TEACHING_ASSIGNMENT_REMOVED', entityType: 'TeachingAssignment', entityId: id } });
    return { success: true };
  }
}