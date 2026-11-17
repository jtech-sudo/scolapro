import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateTimetableEntryDto } from './timetable.dto';

const timetableInclude = {
  assignment: {
    include: {
      class: { include: { level: true, schoolYear: true } },
      subject: true,
      teacher: true,
    },
  },
} as const;

@Injectable()
export class TimetableService {
  constructor(private readonly prisma: PrismaService) {}

  list(schoolYearId?: string) {
    return this.prisma.timetableEntry.findMany({
      where: schoolYearId ? { assignment: { class: { schoolYearId } } } : {},
      include: timetableInclude,
      orderBy: [{ dayOfWeek: 'asc' }, { startsAt: 'asc' }],
    });
  }

  async create(dto: CreateTimetableEntryDto) {
    if (dto.startsAt >= dto.endsAt) {
      throw new BadRequestException('L’heure de fin doit être postérieure à l’heure de début.');
    }

    const assignment = await this.prisma.teachingAssignment.findUnique({
      where: { id: dto.assignmentId },
      include: { class: true, teacher: true, subject: true },
    });
    if (!assignment || !assignment.class.isActive || !assignment.teacher.isActive || !assignment.subject.isActive) {
      throw new NotFoundException('Cette affectation pédagogique est introuvable ou inactive.');
    }

    const overlaps = await this.prisma.timetableEntry.findMany({
      where: {
        dayOfWeek: dto.dayOfWeek,
        assignment: { class: { schoolYearId: assignment.class.schoolYearId } },
        startsAt: { lt: dto.endsAt },
        endsAt: { gt: dto.startsAt },
        OR: [
          { assignment: { classId: assignment.classId } },
          { assignment: { teacherId: assignment.teacherId } },
        ],
      },
      include: { assignment: { include: { class: true, teacher: true } } },
    });

    if (overlaps.some((entry) => entry.assignment.classId === assignment.classId)) {
      throw new BadRequestException('La classe a déjà un cours pendant ce créneau.');
    }
    if (overlaps.some((entry) => entry.assignment.teacherId === assignment.teacherId)) {
      throw new BadRequestException('L’enseignant a déjà un cours pendant ce créneau.');
    }

    const entry = await this.prisma.timetableEntry.create({
      data: {
        assignmentId: assignment.id,
        dayOfWeek: dto.dayOfWeek,
        startsAt: dto.startsAt,
        endsAt: dto.endsAt,
        room: dto.room?.trim() || null,
      },
      include: timetableInclude,
    });
    await this.prisma.auditLog.create({
      data: {
        action: 'TIMETABLE_ENTRY_CREATED',
        entityType: 'TimetableEntry',
        entityId: entry.id,
        details: { assignmentId: assignment.id, dayOfWeek: dto.dayOfWeek, startsAt: dto.startsAt, endsAt: dto.endsAt },
      },
    });
    return entry;
  }

  async delete(id: string) {
    const entry = await this.prisma.timetableEntry.findUnique({ where: { id } });
    if (!entry) throw new NotFoundException('Ce cours est introuvable.');

    await this.prisma.$transaction(async (transaction) => {
      await transaction.timetableEntry.delete({ where: { id } });
      await transaction.auditLog.create({
        data: {
          action: 'TIMETABLE_ENTRY_DELETED',
          entityType: 'TimetableEntry',
          entityId: id,
          details: { dayOfWeek: entry.dayOfWeek, startsAt: entry.startsAt, endsAt: entry.endsAt },
        },
      });
    });
    return { deleted: true };
  }
}
