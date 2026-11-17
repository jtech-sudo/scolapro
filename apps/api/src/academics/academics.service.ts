import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AssessmentStatus, Prisma, StudentExamQuestionType } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CreateAssessmentDto, CreateExamQuestionDto, ListAssessmentsDto, SaveGradesDto, UpdateAssessmentDto, UpdateOnlineAssessmentDto } from './academics.dto';

const assessmentInclude = {
  class: { include: { level: true, schoolYear: true } },
  subject: true,
  term: true,
  grades: { include: { student: true }, orderBy: [{ student: { lastName: 'asc' as const } }, { student: { firstName: 'asc' as const } }] },
} satisfies Prisma.AssessmentInclude;

@Injectable()
export class AcademicsService {
  constructor(private readonly prisma: PrismaService) {}

  listTeachingAssignments(schoolYearId?: string) {
    return this.prisma.teachingAssignment.findMany({
      where: schoolYearId ? { class: { schoolYearId, isActive: true }, teacher: { isActive: true }, subject: { isActive: true } } : {},
      include: { class: { include: { level: true, schoolYear: { include: { terms: { orderBy: { order: 'asc' } } } } } }, subject: true, teacher: true },
      orderBy: [{ class: { level: { sortOrder: 'asc' } } }, { subject: { name: 'asc' } }],
    });
  }

  async getClassRoster(classId: string) {
    const schoolClass = await this.prisma.schoolClass.findUnique({ where: { id: classId }, include: { level: true, schoolYear: true } });
    if (!schoolClass) throw new NotFoundException('Classe introuvable.');
    const enrollments = await this.prisma.enrollment.findMany({
      where: { classId, status: 'ACTIVE', student: { isActive: true } },
      include: { student: { include: { guardians: { where: { isPrimary: true }, include: { guardian: true } } } } },
      orderBy: [{ student: { lastName: 'asc' } }, { student: { firstName: 'asc' } }],
    });
    return { schoolClass, students: enrollments.map((enrollment) => enrollment.student) };
  }

  async listAssessments(query: ListAssessmentsDto) {
    const assessments = await this.prisma.assessment.findMany({
      where: {
        ...(query.classId ? { classId: query.classId } : {}),
        ...(query.subjectId ? { subjectId: query.subjectId } : {}),
        ...(query.termId ? { termId: query.termId } : {}),
      },
      include: assessmentInclude,
      orderBy: [{ assessmentDate: 'desc' }, { createdAt: 'desc' }],
    });
    return assessments.map((assessment) => this.serializeAssessment(assessment));
  }

  async createAssessment(dto: CreateAssessmentDto) {
    const maximumScore = new Prisma.Decimal(dto.maximumScore);
    const coefficient = new Prisma.Decimal(dto.coefficient ?? '1');
    if (maximumScore.lte(0) || coefficient.lte(0)) throw new BadRequestException('Le barème et le coefficient doivent être supérieurs à zéro.');
    const assignment = await this.prisma.teachingAssignment.findUnique({
      where: { classId_subjectId: { classId: dto.classId, subjectId: dto.subjectId } },
      include: { class: true, subject: true },
    });
    if (!assignment) throw new BadRequestException('Cette matière n’est pas affectée à la classe choisie. Configurez d’abord les affectations pédagogiques.');
    const term = await this.prisma.term.findUnique({ where: { id: dto.termId } });
    if (!term || term.schoolYearId !== assignment.class.schoolYearId) throw new BadRequestException('Le trimestre ne correspond pas à l’année de cette classe.');
    const assessmentDate = new Date(dto.assessmentDate);
    if (assessmentDate < term.startsOn || assessmentDate > term.endsOn) throw new BadRequestException('La date de l’évaluation doit se trouver dans le trimestre sélectionné.');

    return this.prisma.$transaction(async (transaction) => {
      const assessment = await transaction.assessment.create({
        data: {
          name: dto.name.trim(), assessmentType: dto.assessmentType.trim(), classId: dto.classId,
          subjectId: dto.subjectId, termId: dto.termId, assessmentDate, maximumScore, coefficient,
        },
        include: assessmentInclude,
      });
      await transaction.auditLog.create({ data: { action: 'ASSESSMENT_CREATED', entityType: 'Assessment', entityId: assessment.id, details: { classId: dto.classId, subjectId: dto.subjectId, termId: dto.termId, maximumScore: maximumScore.toFixed(2), coefficient: coefficient.toFixed(2) } } });
      return this.serializeAssessment(assessment);
    });
  }

  async updateAssessment(id: string, dto: UpdateAssessmentDto) {
    const existing = await this.prisma.assessment.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Évaluation introuvable.');
    const changingFields = Object.keys(dto).filter((key) => key !== 'status');
    if (existing.status === AssessmentStatus.LOCKED && changingFields.length) throw new BadRequestException('Une évaluation verrouillée ne peut être modifiée. Rouvrez-la explicitement avant toute correction.');
    const maximumScore = dto.maximumScore !== undefined ? new Prisma.Decimal(dto.maximumScore) : undefined;
    const coefficient = dto.coefficient !== undefined ? new Prisma.Decimal(dto.coefficient) : undefined;
    if (maximumScore?.lte(0) || coefficient?.lte(0)) throw new BadRequestException('Le barème et le coefficient doivent être supérieurs à zéro.');
    if (maximumScore) {
      const invalidGrade = await this.prisma.grade.findFirst({ where: { assessmentId: id, score: { gt: maximumScore } } });
      if (invalidGrade) throw new BadRequestException('Le nouveau barème est inférieur à une note déjà saisie.');
    }
    const assessment = await this.prisma.assessment.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.assessmentType !== undefined ? { assessmentType: dto.assessmentType.trim() } : {}),
        ...(dto.assessmentDate !== undefined ? { assessmentDate: new Date(dto.assessmentDate) } : {}),
        ...(maximumScore ? { maximumScore } : {}),
        ...(coefficient ? { coefficient } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
      include: assessmentInclude,
    });
    await this.prisma.auditLog.create({ data: { action: dto.status === AssessmentStatus.LOCKED ? 'ASSESSMENT_LOCKED' : dto.status === AssessmentStatus.OPEN ? 'ASSESSMENT_REOPENED' : 'ASSESSMENT_UPDATED', entityType: 'Assessment', entityId: id, details: { changedFields: Object.keys(dto) } } });
    return this.serializeAssessment(assessment);
  }

  async saveGrades(assessmentId: string, dto: SaveGradesDto) {
    if (new Set(dto.grades.map((grade) => grade.studentId)).size !== dto.grades.length) throw new BadRequestException('Chaque élève ne peut apparaître qu’une fois dans la saisie.');
    return this.prisma.$transaction(async (transaction) => {
      const assessment = await transaction.assessment.findUnique({ where: { id: assessmentId }, include: { grades: true } });
      if (!assessment) throw new NotFoundException('Évaluation introuvable.');
      if (assessment.status === AssessmentStatus.LOCKED) throw new BadRequestException('Cette évaluation est verrouillée. Rouvrez-la avant une correction.');
      const scoreEntries = dto.grades.map((grade) => ({ ...grade, score: new Prisma.Decimal(grade.score) }));
      if (scoreEntries.some((grade) => grade.score.lt(0) || grade.score.gt(assessment.maximumScore))) {
        throw new BadRequestException(`Chaque note doit être comprise entre 0 et ${assessment.maximumScore.toFixed(2)}.`);
      }
      const enrollments = await transaction.enrollment.findMany({
        where: { classId: assessment.classId, status: 'ACTIVE', studentId: { in: scoreEntries.map((grade) => grade.studentId) } },
        select: { studentId: true },
      });
      if (enrollments.length !== scoreEntries.length) throw new BadRequestException('Une ou plusieurs personnes ne sont pas inscrites dans cette classe.');

      const beforeByStudent = new Map(assessment.grades.map((grade) => [grade.studentId, grade.score.toFixed(2)]));
      for (const grade of scoreEntries) {
        await transaction.grade.upsert({
          where: { assessmentId_studentId: { assessmentId, studentId: grade.studentId } },
          create: { assessmentId, studentId: grade.studentId, score: grade.score, comment: grade.comment?.trim() || null },
          update: { score: grade.score, comment: grade.comment?.trim() || null },
        });
      }
      await transaction.auditLog.create({
        data: {
          action: 'GRADES_SAVED', entityType: 'Assessment', entityId: assessmentId,
          details: { entries: scoreEntries.map((grade) => ({ studentId: grade.studentId, previousScore: beforeByStudent.get(grade.studentId) ?? null, newScore: grade.score.toFixed(2) })) },
        },
      });
      const updated = await transaction.assessment.findUniqueOrThrow({ where: { id: assessmentId }, include: assessmentInclude });
      return this.serializeAssessment(updated);
    });
  }

  async getTermSummary(classId: string, subjectId: string, termId: string) {
    const assessment = await this.prisma.assessment.findFirst({ where: { classId, subjectId, termId } });
    if (!assessment) return { classId, subjectId, termId, assessmentCount: 0, students: [] };
    const assessments = await this.prisma.assessment.findMany({
      where: { classId, subjectId, termId },
      include: { grades: { include: { student: true } } },
      orderBy: { assessmentDate: 'asc' },
    });
    const roster = await this.prisma.enrollment.findMany({
      where: { classId, status: 'ACTIVE', student: { isActive: true } },
      include: { student: true },
      orderBy: [{ student: { lastName: 'asc' } }, { student: { firstName: 'asc' } }],
    });
    const students = roster.map(({ student }) => {
      let weightedPercent = new Prisma.Decimal(0);
      let coefficientTotal = new Prisma.Decimal(0);
      let enteredCount = 0;
      for (const item of assessments) {
        const grade = item.grades.find((candidate) => candidate.studentId === student.id);
        if (!grade) continue;
        const ratioPercent = grade.score.div(item.maximumScore).mul(100);
        weightedPercent = weightedPercent.plus(ratioPercent.mul(item.coefficient));
        coefficientTotal = coefficientTotal.plus(item.coefficient);
        enteredCount += 1;
      }
      return {
        student,
        assessmentCount: enteredCount,
        averagePercent: coefficientTotal.gt(0) ? weightedPercent.div(coefficientTotal).toDecimalPlaces(2).toFixed(2) : null,
      };
    });
    return { classId, subjectId, termId, assessmentCount: assessments.length, students };
  }

  async updateOnlineAssessment(id: string, dto: UpdateOnlineAssessmentDto) {
    const assessment = await this.prisma.assessment.findUnique({ where: { id } });
    if (!assessment) throw new NotFoundException('Évaluation introuvable.');
    const onlineStartsAt = dto.onlineStartsAt === undefined ? assessment.onlineStartsAt : dto.onlineStartsAt ? new Date(dto.onlineStartsAt) : null;
    const onlineEndsAt = dto.onlineEndsAt === undefined ? assessment.onlineEndsAt : dto.onlineEndsAt ? new Date(dto.onlineEndsAt) : null;
    if (onlineStartsAt && onlineEndsAt && onlineEndsAt <= onlineStartsAt) {
      throw new BadRequestException('La date de fin doit être après la date de début d’ouverture.');
    }
    if (dto.onlineEnabled !== undefined && dto.onlineEnabled && (!onlineStartsAt || !onlineEndsAt)) {
      throw new BadRequestException('Pour publier une épreuve en ligne, définissez une date de début et de fin d’ouverture.');
    }
    return this.prisma.assessment.update({
      where: { id },
      data: {
        ...(dto.onlineEnabled !== undefined ? { onlineEnabled: dto.onlineEnabled } : {}),
        ...(dto.onlineStartsAt !== undefined ? { onlineStartsAt } : {}),
        ...(dto.onlineEndsAt !== undefined ? { onlineEndsAt } : {}),
      },
      include: assessmentInclude,
    });
  }

  async addExamQuestion(assessmentId: string, dto: CreateExamQuestionDto) {
    const assessment = await this.prisma.assessment.findUnique({ where: { id: assessmentId } });
    if (!assessment) throw new NotFoundException('Évaluation introuvable.');
    const maxOrder = await this.prisma.studentExamQuestion.findFirst({
      where: { assessmentId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    const order = (maxOrder?.order ?? 0) + 1;
    if (dto.type === 'MULTIPLE_CHOICE' && (!dto.choices || dto.choices.length < 2)) {
      throw new BadRequestException('Un QCM exige au moins deux choix de réponse.');
    }
    const question = await this.prisma.studentExamQuestion.create({
      data: {
        assessmentId,
        order,
        type: dto.type as StudentExamQuestionType,
        prompt: dto.prompt.trim(),
        points: new Prisma.Decimal(dto.points),
        choices: dto.choices && dto.choices.length > 0 ? {
          create: dto.choices.map((choice, index) => ({
            order: index + 1,
            text: choice.text.trim(),
            isCorrect: Boolean(choice.isCorrect),
          })),
        } : undefined,
      },
      include: { choices: { orderBy: { order: 'asc' } } },
    });
    return question;
  }

  private serializeAssessment<T extends { maximumScore: Prisma.Decimal; coefficient: Prisma.Decimal; grades: Array<{ score: Prisma.Decimal }> }>(assessment: T) {
    return {
      ...assessment,
      maximumScore: assessment.maximumScore.toFixed(2),
      coefficient: assessment.coefficient.toFixed(2),
      grades: assessment.grades.map((grade) => ({ ...grade, score: grade.score.toFixed(2) })),
    };
  }
}