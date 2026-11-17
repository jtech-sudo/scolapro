import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import {
  CreateClassDto,
  CreateLevelDto,
  CreateSchoolYearDto,
  CreateTermDto,
  ListClassesDto,
  UpdateClassDto,
  UpdateLevelDto,
  UpdateSchoolYearDto,
  UpdateTermDto,
} from './school-structure.dto';

@Injectable()
export class SchoolStructureService {
  constructor(private readonly prisma: PrismaService) {}

  listSchoolYears() {
    return this.prisma.schoolYear.findMany({
      include: { _count: { select: { classes: true, terms: true } }, terms: { orderBy: { order: 'asc' } } },
      orderBy: { startsOn: 'desc' },
    });
  }

  async createSchoolYear(dto: CreateSchoolYearDto) {
    const startsOn = new Date(dto.startsOn);
    const endsOn = new Date(dto.endsOn);
    if (startsOn >= endsOn) {
      throw new BadRequestException('La date de fin doit être après la date de début.');
    }

    return this.prisma.$transaction(async (transaction) => {
      const currentYear = await transaction.schoolYear.findFirst({ where: { isCurrent: true }, select: { id: true } });
      const isCurrent = dto.isCurrent || !currentYear;
      if (isCurrent && currentYear) {
        await transaction.schoolYear.updateMany({
          where: { isCurrent: true },
          data: { isCurrent: false },
        });
      }
      const schoolYear = await transaction.schoolYear.create({
        data: { name: dto.name.trim(), startsOn, endsOn, isCurrent },
      });
      await transaction.auditLog.create({
        data: {
          action: 'SCHOOL_YEAR_CREATED',
          entityType: 'SchoolYear',
          entityId: schoolYear.id,
          details: { name: schoolYear.name },
        },
      });
      return schoolYear;
    });
  }

  async updateSchoolYear(id: string, dto: UpdateSchoolYearDto) {
    const existing = await this.prisma.schoolYear.findUnique({ where: { id } });
    if (!existing) throw new BadRequestException('Année scolaire introuvable.');
    const startsOn = dto.startsOn ? new Date(dto.startsOn) : existing.startsOn;
    const endsOn = dto.endsOn ? new Date(dto.endsOn) : existing.endsOn;
    if (startsOn >= endsOn) throw new BadRequestException('La date de fin doit être après la date de début.');

    return this.prisma.$transaction(async (transaction) => {
      if (dto.isCurrent) {
        await transaction.schoolYear.updateMany({ where: { isCurrent: true, id: { not: id } }, data: { isCurrent: false } });
      }
      const schoolYear = await transaction.schoolYear.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          startsOn,
          endsOn,
          ...(dto.isCurrent !== undefined ? { isCurrent: dto.isCurrent } : {}),
        },
        include: { terms: { orderBy: { order: 'asc' } } },
      });
      await transaction.auditLog.create({ data: { action: 'SCHOOL_YEAR_UPDATED', entityType: 'SchoolYear', entityId: id, details: { changedFields: Object.keys(dto) } } });
      return schoolYear;
    });
  }

  async createTerm(schoolYearId: string, dto: CreateTermDto) {
    const schoolYear = await this.prisma.schoolYear.findUnique({ where: { id: schoolYearId } });
    if (!schoolYear) throw new BadRequestException('Année scolaire introuvable.');
    const startsOn = new Date(dto.startsOn);
    const endsOn = new Date(dto.endsOn);
    if (startsOn >= endsOn) throw new BadRequestException('La date de fin du trimestre doit être après la date de début.');
    if (startsOn < schoolYear.startsOn || endsOn > schoolYear.endsOn) {
      throw new BadRequestException('Les dates du trimestre doivent être comprises dans l’année scolaire.');
    }
    const term = await this.prisma.term.create({ data: { ...dto, name: dto.name.trim(), startsOn, endsOn, schoolYearId } });
    await this.prisma.auditLog.create({ data: { action: 'TERM_CREATED', entityType: 'Term', entityId: term.id, details: { schoolYearId, name: term.name, order: term.order } } });
    return term;
  }

  async updateTerm(id: string, dto: UpdateTermDto) {
    const existing = await this.prisma.term.findUnique({ where: { id }, include: { schoolYear: true } });
    if (!existing) throw new BadRequestException('Trimestre introuvable.');
    const startsOn = dto.startsOn ? new Date(dto.startsOn) : existing.startsOn;
    const endsOn = dto.endsOn ? new Date(dto.endsOn) : existing.endsOn;
    if (startsOn >= endsOn || startsOn < existing.schoolYear.startsOn || endsOn > existing.schoolYear.endsOn) {
      throw new BadRequestException('Les dates du trimestre doivent être cohérentes et comprises dans l’année scolaire.');
    }
    const term = await this.prisma.term.update({
      where: { id },
      data: { ...(dto.name !== undefined ? { name: dto.name.trim() } : {}), ...(dto.order !== undefined ? { order: dto.order } : {}), startsOn, endsOn },
    });
    await this.prisma.auditLog.create({ data: { action: 'TERM_UPDATED', entityType: 'Term', entityId: id, details: { changedFields: Object.keys(dto) } } });
    return term;
  }

  listLevels() {
    return this.prisma.level.findMany({
      include: { _count: { select: { classes: true } } },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async createLevel(dto: CreateLevelDto) {
    const level = await this.prisma.level.create({
      data: { name: dto.name.trim(), type: dto.type, sortOrder: dto.sortOrder },
    });
    await this.prisma.auditLog.create({
      data: {
        action: 'LEVEL_CREATED',
        entityType: 'Level',
        entityId: level.id,
        details: { name: level.name, type: level.type },
      },
    });
    return level;
  }

  async updateLevel(id: string, dto: UpdateLevelDto) {
    const level = await this.prisma.level.update({
      where: { id },
      data: { ...(dto.name !== undefined ? { name: dto.name.trim() } : {}), ...(dto.type !== undefined ? { type: dto.type } : {}), ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}), ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}) },
    });
    await this.prisma.auditLog.create({ data: { action: 'LEVEL_UPDATED', entityType: 'Level', entityId: id, details: { changedFields: Object.keys(dto) } } });
    return level;
  }

  async deleteLevel(id: string) {
    const level = await this.prisma.level.findUnique({ where: { id }, include: { _count: { select: { classes: true } } } });
    if (!level) throw new NotFoundException('Niveau introuvable.');
    if (level._count.classes > 0) {
      const archived = await this.prisma.level.update({ where: { id }, data: { isActive: false } });
      await this.prisma.auditLog.create({ data: { action: 'LEVEL_ARCHIVED', entityType: 'Level', entityId: id, details: { linkedClasses: level._count.classes } } });
      return { deleted: false, archived: true, message: 'Le niveau contient des classes et a été archivé pour préserver l’historique.', level: archived };
    }
    await this.prisma.$transaction(async (transaction) => {
      await transaction.level.delete({ where: { id } });
      await transaction.auditLog.create({ data: { action: 'LEVEL_DELETED', entityType: 'Level', entityId: id, details: { name: level.name } } });
    });
    return { deleted: true, archived: false, message: 'Niveau supprimé.' };
  }

  listClasses(query: ListClassesDto) {
    return this.prisma.schoolClass.findMany({
      where: {
        ...(query.schoolYearId ? { schoolYearId: query.schoolYearId } : {}),
        ...(query.levelId ? { levelId: query.levelId } : {}),
      },
      include: {
        level: true,
        schoolYear: true,
        _count: { select: { enrollments: true } },
      },
      orderBy: [{ level: { sortOrder: 'asc' } }, { name: 'asc' }],
    });
  }

  async createClass(dto: CreateClassDto) {
    const schoolClass = await this.prisma.schoolClass.create({
      data: {
        name: dto.name.trim(),
        levelId: dto.levelId,
        schoolYearId: dto.schoolYearId,
      },
      include: { level: true, schoolYear: true },
    });
    await this.prisma.auditLog.create({
      data: {
        action: 'CLASS_CREATED',
        entityType: 'SchoolClass',
        entityId: schoolClass.id,
        details: { name: schoolClass.name, levelId: schoolClass.levelId },
      },
    });
    return schoolClass;
  }

  async updateClass(id: string, dto: UpdateClassDto) {
    const schoolClass = await this.prisma.schoolClass.update({
      where: { id },
      data: { ...(dto.name !== undefined ? { name: dto.name.trim() } : {}), ...(dto.levelId !== undefined ? { levelId: dto.levelId } : {}), ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}) },
      include: { level: true, schoolYear: true, _count: { select: { enrollments: true } } },
    });
    await this.prisma.auditLog.create({ data: { action: 'CLASS_UPDATED', entityType: 'SchoolClass', entityId: id, details: { changedFields: Object.keys(dto) } } });
    return schoolClass;
  }

  async deleteClass(id: string) {
    const schoolClass = await this.prisma.schoolClass.findUnique({
      where: { id },
      include: {
        _count: { select: { enrollments: true, teachingAssignments: true, assessments: true, reportCards: true, attendanceSessions: true } },
      },
    });
    if (!schoolClass) throw new NotFoundException('Classe introuvable.');
    const linkedRecords = Object.values(schoolClass._count).reduce((total, count) => total + count, 0);
    if (linkedRecords > 0) {
      const archived = await this.prisma.schoolClass.update({ where: { id }, data: { isActive: false } });
      await this.prisma.auditLog.create({ data: { action: 'CLASS_ARCHIVED', entityType: 'SchoolClass', entityId: id, details: { linkedRecords: schoolClass._count } } });
      return { deleted: false, archived: true, message: 'La classe contient des données historiques et a été archivée.', schoolClass: archived };
    }
    await this.prisma.$transaction(async (transaction) => {
      await transaction.schoolClass.delete({ where: { id } });
      await transaction.auditLog.create({ data: { action: 'CLASS_DELETED', entityType: 'SchoolClass', entityId: id, details: { name: schoolClass.name } } });
    });
    return { deleted: true, archived: false, message: 'Classe supprimée.' };
  }
}