import { randomBytes } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { EnrollmentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import {
  CreateStudentDto,
  ListStudentsDto,
  UpdateStudentDto,
} from './students.dto';

const studentInclude = {
  enrollments: {
    where: { status: EnrollmentStatus.ACTIVE },
    orderBy: { enrolledAt: 'desc' as const },
    take: 1,
    include: {
      schoolClass: {
        include: {
          level: true,
          schoolYear: true,
        },
      },
    },
  },
  guardians: {
    include: { guardian: true },
    orderBy: [{ isPrimary: 'desc' as const }, { guardian: { lastName: 'asc' as const } }],
  },
} satisfies Prisma.StudentInclude;

@Injectable()
export class StudentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListStudentsDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const search = query.search?.trim();
    const where: Prisma.StudentWhereInput = {
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { matricule: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.classId
        ? { enrollments: { some: { classId: query.classId, status: EnrollmentStatus.ACTIVE } } }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.student.findMany({
        where,
        include: studentInclude,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.student.count({ where }),
    ]);

    return { data, pagination: { page, pageSize, total, pageCount: Math.ceil(total / pageSize) } };
  }

  async getDetails(id: string) {
    const student = await this.prisma.student.findUnique({ where: { id }, include: studentInclude });
    if (!student) throw new NotFoundException('Élève introuvable.');

    const [enrollments, grades, reportCards, attendance, invoices, libraryLoans] = await Promise.all([
      this.prisma.enrollment.findMany({
        where: { studentId: id },
        include: { schoolClass: { include: { level: true, schoolYear: true } } },
        orderBy: { enrolledAt: 'desc' },
      }),
      this.prisma.grade.findMany({
        where: { studentId: id },
        include: {
          assessment: {
            include: { subject: true, class: true, term: { include: { schoolYear: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.reportCard.findMany({
        where: { studentId: id },
        include: { schoolClass: true, schoolYear: true, term: true },
        orderBy: [{ schoolYear: { startsOn: 'desc' } }, { term: { order: 'desc' } }],
      }),
      this.prisma.attendanceRecord.findMany({
        where: { studentId: id },
        include: { session: { include: { class: true } } },
        orderBy: { session: { date: 'desc' } },
        take: 100,
      }),
      this.prisma.invoice.findMany({
        where: { studentId: id },
        include: {
          feeType: true,
          schoolYear: true,
          installments: { orderBy: { dueDate: 'asc' } },
          allocations: { include: { payment: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.libraryLoan.findMany({
        where: { studentId: id },
        include: { book: true },
        orderBy: { issuedAt: 'desc' },
      }),
    ]);

    return { ...student, enrollments, grades, reportCards, attendance, invoices, libraryLoans };
  }

  async create(dto: CreateStudentDto) {
    const matricule = dto.matricule?.trim() || this.generateMatricule();
    const firstName = dto.firstName.trim();
    const lastName = dto.lastName.trim();

    return this.prisma.$transaction(async (transaction) => {
      if (dto.classId) {
        const schoolClass = await transaction.schoolClass.findUnique({ where: { id: dto.classId } });
        if (!schoolClass) throw new NotFoundException('La classe sélectionnée est introuvable.');
      }

      const student = await transaction.student.create({
        data: {
          matricule,
          firstName,
          lastName,
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
          sex: dto.sex,
        },
      });

      if (dto.classId) {
        await transaction.enrollment.create({
          data: { studentId: student.id, classId: dto.classId },
        });
      }

      await transaction.auditLog.create({
        data: {
          action: 'STUDENT_CREATED',
          entityType: 'Student',
          entityId: student.id,
          details: { matricule, classId: dto.classId ?? null },
        },
      });

      return transaction.student.findUniqueOrThrow({
        where: { id: student.id },
        include: studentInclude,
      });
    });
  }

  async update(id: string, dto: UpdateStudentDto) {
    const existing = await this.prisma.student.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Élève introuvable.');

    const data: Prisma.StudentUpdateInput = {
      ...(dto.firstName !== undefined ? { firstName: dto.firstName.trim() } : {}),
      ...(dto.lastName !== undefined ? { lastName: dto.lastName.trim() } : {}),
      ...(dto.dateOfBirth !== undefined
        ? { dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null }
        : {}),
      ...(dto.sex !== undefined ? { sex: dto.sex } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
    };

    return this.prisma.$transaction(async (transaction) => {
      const student = await transaction.student.update({
        where: { id },
        data,
        include: studentInclude,
      });
      await transaction.auditLog.create({
        data: {
          action: 'STUDENT_UPDATED',
          entityType: 'Student',
          entityId: id,
          details: { changedFields: Object.keys(data) },
        },
      });
      return student;
    });
  }

  async enroll(id: string, classId: string) {
    return this.prisma.$transaction(async (transaction) => {
      const schoolClass = await transaction.schoolClass.findUnique({ where: { id: classId } });
      if (!schoolClass) throw new NotFoundException('La classe sélectionnée est introuvable.');
      const student = await transaction.student.findUnique({ where: { id } });
      if (!student) throw new NotFoundException('Élève introuvable.');

      const previousSchoolYearEnrollment = await transaction.enrollment.findFirst({
        where: { studentId: id, schoolClass: { schoolYearId: { not: schoolClass.schoolYearId } } },
        select: { id: true },
      });
      const activeEnrollments = await transaction.enrollment.findMany({
        where: { studentId: id, status: EnrollmentStatus.ACTIVE, schoolClass: { schoolYearId: schoolClass.schoolYearId } },
      });
      if (activeEnrollments.some((enrollment) => enrollment.classId === classId)) {
        return transaction.student.findUniqueOrThrow({ where: { id }, include: studentInclude });
      }
      for (const enrollment of activeEnrollments) {
        await transaction.enrollment.update({ where: { id: enrollment.id }, data: { status: EnrollmentStatus.TRANSFERRED } });
      }
      await transaction.enrollment.upsert({
        where: { studentId_classId: { studentId: id, classId } },
        create: { studentId: id, classId },
        update: { status: EnrollmentStatus.ACTIVE, enrolledAt: new Date() },
      });
      await transaction.auditLog.create({
        data: {
          action: previousSchoolYearEnrollment ? 'STUDENT_REENROLLED' : 'STUDENT_ENROLLED',
          entityType: 'Student',
          entityId: id,
          details: {
            classId,
            schoolYearId: schoolClass.schoolYearId,
            previousEnrollmentIds: activeEnrollments.map((enrollment) => enrollment.id),
            isReEnrollment: Boolean(previousSchoolYearEnrollment),
          },
        },
      });
      return transaction.student.findUniqueOrThrow({ where: { id }, include: studentInclude });
    });
  }

  private generateMatricule() {
    const year = new Date().getFullYear().toString().slice(-2);
    const suffix = randomBytes(4).toString('hex').toUpperCase();
    return `NE-${year}-${suffix}`;
  }
}