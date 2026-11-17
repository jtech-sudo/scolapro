import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AttendanceStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AttendanceReportQueryDto, OpenAttendanceSessionDto, SaveAttendanceDto } from './attendance.dto';

const sessionInclude = {
  class: { include: { level: true, schoolYear: true } },
  records: {
    include: { student: true },
    orderBy: [{ student: { lastName: 'asc' as const } }, { student: { firstName: 'asc' as const } }],
  },
} satisfies Prisma.AttendanceSessionInclude;

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  async openSession(dto: OpenAttendanceSessionDto) {
    const schoolClass = await this.prisma.schoolClass.findUnique({ where: { id: dto.classId } });
    if (!schoolClass || !schoolClass.isActive) throw new NotFoundException('Classe introuvable ou archivée.');
    const date = new Date(`${dto.date.slice(0, 10)}T12:00:00.000Z`);
    const session = await this.prisma.$transaction(async (transaction) => {
      const current = await transaction.attendanceSession.upsert({
        where: { classId_date_slot: { classId: dto.classId, date, slot: dto.slot } },
        create: { classId: dto.classId, date, slot: dto.slot },
        update: {},
      });
      const enrollments = await transaction.enrollment.findMany({
        where: { classId: dto.classId, status: 'ACTIVE', student: { isActive: true } },
        select: { studentId: true },
      });
      for (const enrollment of enrollments) {
        await transaction.attendanceRecord.upsert({
          where: { sessionId_studentId: { sessionId: current.id, studentId: enrollment.studentId } },
          create: { sessionId: current.id, studentId: enrollment.studentId, status: AttendanceStatus.PRESENT },
          update: {},
        });
      }
      await transaction.auditLog.create({
        data: { action: 'ATTENDANCE_SESSION_OPENED', entityType: 'AttendanceSession', entityId: current.id, details: { classId: dto.classId, date: dto.date.slice(0, 10), slot: dto.slot, rosterSize: enrollments.length } },
      });
      return current;
    });
    return this.prisma.attendanceSession.findUniqueOrThrow({ where: { id: session.id }, include: sessionInclude });
  }

  async saveRecords(sessionId: string, dto: SaveAttendanceDto) {
    if (new Set(dto.records.map((record) => record.studentId)).size !== dto.records.length) throw new BadRequestException('Un élève ne peut apparaître qu’une fois dans cette feuille d’appel.');
    return this.prisma.$transaction(async (transaction) => {
      const session = await transaction.attendanceSession.findUnique({ where: { id: sessionId } });
      if (!session) throw new NotFoundException('Séance d’appel introuvable.');
      const enrolled = await transaction.enrollment.findMany({
        where: { classId: session.classId, status: 'ACTIVE', student: { isActive: true }, studentId: { in: dto.records.map((record) => record.studentId) } },
        select: { studentId: true },
      });
      if (enrolled.length !== dto.records.length) throw new BadRequestException('Un ou plusieurs élèves ne sont plus inscrits dans cette classe.');

      const previous = await transaction.attendanceRecord.findMany({ where: { sessionId, studentId: { in: dto.records.map((record) => record.studentId) } } });
      const previousByStudent = new Map(previous.map((record) => [record.studentId, record.status]));
      const before = await Promise.all(dto.records.map((record) => transaction.attendanceRecord.upsert({
        where: { sessionId_studentId: { sessionId, studentId: record.studentId } },
        create: {
          sessionId,
          studentId: record.studentId,
          status: record.status,
          arrivalTime: record.status === AttendanceStatus.LATE ? record.arrivalTime ?? null : null,
          reason: record.reason?.trim() || null,
          isJustified: record.isJustified ?? false,
        },
        update: {
          status: record.status,
          arrivalTime: record.status === AttendanceStatus.LATE ? record.arrivalTime ?? null : null,
          reason: record.reason?.trim() || null,
          isJustified: record.isJustified ?? false,
        },
      })));
      const changes = dto.records.filter((record) => previousByStudent.get(record.studentId) !== record.status).map((record) => ({ studentId: record.studentId, previousStatus: previousByStudent.get(record.studentId) ?? null, newStatus: record.status }));
      await transaction.auditLog.create({ data: { action: 'ATTENDANCE_RECORDS_SAVED', entityType: 'AttendanceSession', entityId: sessionId, details: { count: before.length, changes } } });
      return before;
    });
  }

  async updateJustification(recordId: string, reason: string, isJustified: boolean) {
    const record = await this.prisma.attendanceRecord.update({
      where: { id: recordId },
      data: { reason: reason.trim() || null, isJustified },
      include: { student: true, session: { include: { class: true } } },
    });
    await this.prisma.auditLog.create({ data: { action: 'ATTENDANCE_JUSTIFICATION_UPDATED', entityType: 'AttendanceRecord', entityId: recordId, details: { isJustified, reason: reason.trim() } } });
    return record;
  }

  async getReport(query: AttendanceReportQueryDto) {
    const from = new Date(`${query.from.slice(0, 10)}T00:00:00.000Z`);
    const to = new Date(`${query.to.slice(0, 10)}T23:59:59.999Z`);
    if (from > to) throw new BadRequestException('La date de début doit précéder la date de fin.');
    const [schoolClass, records] = await Promise.all([
      this.prisma.schoolClass.findUnique({ where: { id: query.classId }, include: { level: true, schoolYear: true } }),
      this.prisma.attendanceRecord.findMany({
        where: { session: { classId: query.classId, date: { gte: from, lte: to }, ...(query.slot ? { slot: query.slot } : {}) } },
        include: { student: true, session: true },
        orderBy: [{ student: { lastName: 'asc' } }, { session: { date: 'asc' } }],
      }),
    ]);
    if (!schoolClass) throw new NotFoundException('Classe introuvable.');
    const byStudent = new Map<string, { student: (typeof records)[number]['student']; present: number; absent: number; late: number; excused: number; sessions: number }>();
    for (const record of records) {
      const current = byStudent.get(record.studentId) ?? { student: record.student, present: 0, absent: 0, late: 0, excused: 0, sessions: 0 };
      current.sessions += 1;
      if (record.status === AttendanceStatus.PRESENT) current.present += 1;
      if (record.status === AttendanceStatus.ABSENT) current.absent += 1;
      if (record.status === AttendanceStatus.LATE) current.late += 1;
      if (record.status === AttendanceStatus.EXCUSED) current.excused += 1;
      byStudent.set(record.studentId, current);
    }
    return {
      schoolClass,
      period: { from: query.from.slice(0, 10), to: query.to.slice(0, 10), slot: query.slot ?? null },
      sessionCount: new Set(records.map((record) => record.sessionId)).size,
      totals: { present: records.filter((record) => record.status === AttendanceStatus.PRESENT).length, absent: records.filter((record) => record.status === AttendanceStatus.ABSENT).length, late: records.filter((record) => record.status === AttendanceStatus.LATE).length, excused: records.filter((record) => record.status === AttendanceStatus.EXCUSED).length },
      students: Array.from(byStudent.values()).map((item) => ({ ...item, attendanceRate: item.sessions ? new Prisma.Decimal(item.present + item.late + item.excused).div(item.sessions).mul(100).toDecimalPlaces(1).toFixed(1) : '0.0' })),
    };
  }
}