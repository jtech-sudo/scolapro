import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ReportCardRuleScope, ReportCardStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CreateReportCardRuleDto, ListReportCardsDto, PreviewReportCardsDto, UpdateReportCardDto } from './report-cards.dto';


@Injectable()
export class ReportCardsService {
  constructor(private readonly prisma: PrismaService) {}

  listRules(schoolYearId?: string) {
    return this.prisma.reportCardRule.findMany({
      where: schoolYearId ? { schoolYearId } : {},
      include: { level: true, schoolClass: true, schoolYear: true, term: true },
      orderBy: [{ schoolYear: { startsOn: 'desc' } }, { term: { order: 'asc' } }, { level: { sortOrder: 'asc' } }],
    });
  }

  async createRule(dto: CreateReportCardRuleDto) {
    if (dto.scope === ReportCardRuleScope.CLASS && !dto.classId) throw new BadRequestException('Une règle de portée classe doit cibler une classe.');
    if (dto.scope === ReportCardRuleScope.LEVEL && dto.classId) throw new BadRequestException('Une règle par niveau ne doit pas cibler une classe précise.');
    if (dto.mentions?.length && !dto.mentions.some((mention) => mention.minimum === 0)) {
      throw new BadRequestException('Ajoutez un seuil de mention à 0 pour couvrir les moyennes les plus faibles.');
    }
    const [level, schoolYear, term, schoolClass] = await Promise.all([
      this.prisma.level.findUnique({ where: { id: dto.levelId } }),
      this.prisma.schoolYear.findUnique({ where: { id: dto.schoolYearId } }),
      this.prisma.term.findUnique({ where: { id: dto.termId } }),
      dto.classId ? this.prisma.schoolClass.findUnique({ where: { id: dto.classId } }) : Promise.resolve(null),
    ]);
    if (!level || !schoolYear || !term) throw new BadRequestException('Le niveau, l’année ou le trimestre sélectionné est introuvable.');
    if (term.schoolYearId !== schoolYear.id) throw new BadRequestException('Le trimestre ne correspond pas à l’année scolaire sélectionnée.');
    if (dto.classId && (!schoolClass || schoolClass.levelId !== level.id || schoolClass.schoolYearId !== schoolYear.id)) {
      throw new BadRequestException('La classe doit appartenir au niveau et à l’année scolaire sélectionnés.');
    }

    const calculationConfig: CalculationConfig = { formula: dto.formula, rankByAverage: dto.rankByAverage };
    const mentionConfig: MentionConfig = {
      thresholds: (dto.mentions?.length ? dto.mentions : [{ minimum: 0, label: 'Aucune mention' }])
        .slice().sort((a, b) => b.minimum - a.minimum),
    };
    return this.prisma.$transaction(async (transaction) => {
      const sameScope = await transaction.reportCardRule.findFirst({
        where: { levelId: level.id, schoolYearId: schoolYear.id, termId: term.id, ...(dto.scope === ReportCardRuleScope.CLASS ? { classId: dto.classId } : { classId: null }), effective: true },
      });
      if (sameScope) throw new BadRequestException('Une règle active existe déjà pour cette portée, cette année et cette période. Modifiez-la ou désactivez-la avant d’en créer une autre.');
      const rule = await transaction.reportCardRule.create({
        data: {
          name: dto.name.trim(), scope: dto.scope, levelId: level.id, classId: dto.classId ?? null,
          schoolYearId: schoolYear.id, termId: term.id, maximumScore: new Prisma.Decimal(dto.maximumScore),
          calculationConfig, mentionConfig,
        },
        include: { level: true, schoolClass: true, schoolYear: true, term: true },
      });
      await transaction.auditLog.create({ data: { action: 'REPORT_CARD_RULE_CREATED', entityType: 'ReportCardRule', entityId: rule.id, details: { scope: rule.scope, classId: rule.classId, schoolYearId: rule.schoolYearId, termId: rule.termId, formula: dto.formula } } });
      return rule;
    });
  }

  async updateRule(id: string, effective: boolean) {
    const rule = await this.prisma.reportCardRule.update({ where: { id }, data: { effective }, include: { level: true, schoolClass: true, schoolYear: true, term: true } });
    await this.prisma.auditLog.create({ data: { action: effective ? 'REPORT_CARD_RULE_ACTIVATED' : 'REPORT_CARD_RULE_DEACTIVATED', entityType: 'ReportCardRule', entityId: id } });
    return rule;
  }

  async preview(dto: PreviewReportCardsDto) {
    const { context, roster, assessments, rule } = await this.getCalculationContext(dto.classId, dto.termId);
    const cards = this.calculateCards(context, roster, assessments, rule);
    return { rule: this.publicRule(rule), class: context.schoolClass, term: context.term, students: cards };
  }

  async generate(dto: PreviewReportCardsDto) {
    const { context, roster, assessments, rule } = await this.getCalculationContext(dto.classId, dto.termId);
    const cards = this.calculateCards(context, roster, assessments, rule);
    if (!cards.length) throw new BadRequestException('Aucun élève actif n’est inscrit dans cette classe.');
    if (cards.every((card) => card.subjects.every((subject) => subject.average === null))) {
      throw new BadRequestException('Aucune note ne peut être utilisée pour générer les bulletins de cette période.');
    }
    const reportCards = await this.prisma.$transaction(async (transaction) => {
      const results = [];
      for (const card of cards) {
        const existing = await transaction.reportCard.findFirst({
          where: { studentId: card.student.id, termId: context.term.id },
        });
        if (existing?.status === ReportCardStatus.VALIDATED) throw new BadRequestException('Un bulletin déjà validé existe. Rouvrez-le explicitement avant la génération.');
        const data = {
          classId: context.schoolClass.id,
          schoolYearId: context.schoolYear.id,
          termId: context.term.id,
          calculation: card as unknown as Prisma.InputJsonObject,
          overallAverage: card.overallAverage === null ? null : new Prisma.Decimal(card.overallAverage),
          rank: card.rank,
          classSize: card.classSize,
        };
        results.push(existing
          ? await transaction.reportCard.update({
              where: { id: existing.id },
              data,
              include: { student: true, schoolClass: { include: { level: true } }, schoolYear: true, term: true },
            })
          : await transaction.reportCard.create({
              data: { studentId: card.student.id, ...data },
              include: { student: true, schoolClass: { include: { level: true } }, schoolYear: true, term: true },
            }));
      }
      await transaction.auditLog.create({ data: { action: 'REPORT_CARDS_GENERATED', entityType: 'ReportCard', details: { classId: context.schoolClass.id, termId: context.term.id, count: results.length } } });
      return results;
    });
    return reportCards;
  }

  listReportCards(query: ListReportCardsDto) {
    return this.prisma.reportCard.findMany({
      where: { classId: query.classId, termId: query.termId },
      include: { student: true, schoolClass: { include: { level: true } }, schoolYear: true, term: true },
      orderBy: [{ rank: 'asc' }, { student: { lastName: 'asc' } }],
    });
  }

  async updateReportCard(id: string, dto: UpdateReportCardDto) {
    const existing = await this.prisma.reportCard.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Bulletin introuvable.');
    if (existing.status === ReportCardStatus.VALIDATED && dto.status !== ReportCardStatus.DRAFT) {
      if (dto.generalComment !== undefined) throw new BadRequestException('Un bulletin validé ne peut être modifié. Rouvrez-le d’abord.');
    }
    const validating = dto.status === ReportCardStatus.VALIDATED;
    const reopening = existing.status === ReportCardStatus.VALIDATED && dto.status === ReportCardStatus.DRAFT;
    const reportCard = await this.prisma.reportCard.update({
      where: { id },
      data: {
        ...(dto.generalComment !== undefined ? { generalComment: dto.generalComment?.trim() || null } : {}),
        ...(dto.status !== undefined ? { status: dto.status, validatedAt: validating ? new Date() : null, validatedById: validating ? 'local-demo' : null } : {}),
      },
      include: { student: true, schoolClass: { include: { level: true } }, schoolYear: true, term: true },
    });
    await this.prisma.auditLog.create({ data: { action: validating ? 'REPORT_CARD_VALIDATED' : reopening ? 'REPORT_CARD_REOPENED' : 'REPORT_CARD_UPDATED', entityType: 'ReportCard', entityId: id, details: { changedFields: Object.keys(dto) } } });
    return reportCard;
  }

  private async getCalculationContext(classId: string, termId: string) {
    const schoolClass = await this.prisma.schoolClass.findUnique({ where: { id: classId }, include: { level: true, schoolYear: true } });
    const term = await this.prisma.term.findUnique({ where: { id: termId } });
    if (!schoolClass || !term) throw new NotFoundException('Classe ou période scolaire introuvable.');
    if (term.schoolYearId !== schoolClass.schoolYearId) throw new BadRequestException('La période sélectionnée ne correspond pas à l’année de cette classe.');
    const rule = await this.prisma.reportCardRule.findFirst({
      where: { levelId: schoolClass.levelId, schoolYearId: schoolClass.schoolYearId, termId, effective: true, scope: ReportCardRuleScope.CLASS, classId },
    }) ?? await this.prisma.reportCardRule.findFirst({
      where: { levelId: schoolClass.levelId, schoolYearId: schoolClass.schoolYearId, termId, effective: true, scope: ReportCardRuleScope.LEVEL, classId: null },
    });
    if (!rule) throw new BadRequestException('Aucune règle de calcul active pour ce niveau/classe, cette année et ce trimestre. Configurez d’abord les règles de bulletin.');
    const [roster, assessments] = await Promise.all([
      this.prisma.enrollment.findMany({ where: { classId, status: 'ACTIVE', student: { isActive: true } }, include: { student: true }, orderBy: [{ student: { lastName: 'asc' } }, { student: { firstName: 'asc' } }] }),
      this.prisma.assessment.findMany({
        where: { classId, termId },
        include: { subject: true, grades: true },
        orderBy: [{ subject: { name: 'asc' } }, { assessmentDate: 'asc' }],
      }),
    ]);
    return { context: { schoolClass, schoolYear: schoolClass.schoolYear, term }, roster: roster.map(({ student }) => student), assessments, rule };
  }

  private calculateCards(context: { schoolClass: { id: string; level: { name: string }; schoolYearId: string }; schoolYear: { id: string }; term: { id: string; name: string } }, roster: Array<{ id: string; firstName: string; lastName: string; matricule: string }>, assessments: Array<{ id: string; name: string; assessmentType: string; subjectId: string; subject: { name: string; code: string }; maximumScore: Prisma.Decimal; coefficient: Prisma.Decimal; grades: Array<{ studentId: string; score: Prisma.Decimal; comment: string | null }> }>, rule: { id: string; maximumScore: Prisma.Decimal; calculationConfig: Prisma.JsonValue; mentionConfig: Prisma.JsonValue }) {
    const calculationConfig = rule.calculationConfig as CalculationConfig;
    const mentionConfig = rule.mentionConfig as MentionConfig;
    const students = roster.map((student) => {
      const subjectMap = new Map<string, { name: string; code: string; weightedRaw: Prisma.Decimal; weightedPercent: Prisma.Decimal; coefficientTotal: Prisma.Decimal; assessmentCount: number; grades: unknown[] }>();
      for (const assessment of assessments) {
        const grade = assessment.grades.find((item) => item.studentId === student.id);
        const current = subjectMap.get(assessment.subjectId) ?? { name: assessment.subject.name, code: assessment.subject.code, weightedRaw: new Prisma.Decimal(0), weightedPercent: new Prisma.Decimal(0), coefficientTotal: new Prisma.Decimal(0), assessmentCount: 0, grades: [] };
        if (grade) {
          const normalized = grade.score.div(assessment.maximumScore).mul(rule.maximumScore);
          current.weightedRaw = current.weightedRaw.plus(grade.score.mul(assessment.coefficient));
          current.weightedPercent = current.weightedPercent.plus(normalized.mul(assessment.coefficient));
          current.coefficientTotal = current.coefficientTotal.plus(assessment.coefficient);
          current.assessmentCount += 1;
          current.grades.push({ assessmentId: assessment.id, name: assessment.name, type: assessment.assessmentType, score: grade.score.toFixed(2), maximumScore: assessment.maximumScore.toFixed(2), coefficient: assessment.coefficient.toFixed(2), comment: grade.comment });
        }
        subjectMap.set(assessment.subjectId, current);
      }
      const subjects = Array.from(subjectMap.values()).map((subject) => {
        const total = subject.coefficientTotal;
        const average = total.gt(0)
          ? (calculationConfig.formula === 'WEIGHTED_RAW_SCORE' ? subject.weightedRaw.div(total) : subject.weightedPercent.div(total)).toDecimalPlaces(2)
          : null;
        return { subjectId: Array.from(subjectMap.entries()).find(([, value]) => value === subject)?.[0], name: subject.name, code: subject.code, assessmentCount: subject.assessmentCount, average: average?.toFixed(2) ?? null, coefficientTotal: total.toFixed(2), grades: subject.grades };
      });
      const included = subjects.filter((subject) => subject.average !== null);
      const weightedTotal = included.reduce((sum, subject) => sum.plus(new Prisma.Decimal(subject.average!).mul(new Prisma.Decimal(subject.coefficientTotal))), new Prisma.Decimal(0));
      const coefficientTotal = included.reduce((sum, subject) => sum.plus(new Prisma.Decimal(subject.coefficientTotal)), new Prisma.Decimal(0));
      const overall = coefficientTotal.gt(0) ? weightedTotal.div(coefficientTotal).toDecimalPlaces(2) : null;
      const mentionScore = overall && rule.maximumScore.gt(0)
        ? overall.div(rule.maximumScore).mul(100)
        : null;
      const mention = mentionScore !== null ? mentionConfig.thresholds.find((item) => mentionScore.gte(item.minimum))?.label ?? null : null;
      return {
        student: {
          id: student.id,
          firstName: student.firstName,
          lastName: student.lastName,
          matricule: student.matricule,
        },
        subjects,
        overallAverage: overall?.toFixed(2) ?? null,
        mention,
        rank: null as number | null,
        classSize: roster.length,
      };
    });
    if (calculationConfig.rankByAverage) {
      const ranked = students.filter((card) => card.overallAverage !== null).sort((a, b) => Number(b.overallAverage) - Number(a.overallAverage));
      let rank = 0;
      let lastAverage: string | null = null;
      ranked.forEach((card, index) => {
        if (card.overallAverage !== lastAverage) rank = index + 1;
        card.rank = rank;
        lastAverage = card.overallAverage;
      });
    }
    return students.map((card) => ({ ...card, ruleId: rule.id, formula: calculationConfig.formula, maximumScore: rule.maximumScore.toFixed(2), term: context.term.name, classId: context.schoolClass.id, schoolYearId: context.schoolYear.id }));
  }

  private publicRule(rule: { id: string; name: string; scope: ReportCardRuleScope; maximumScore: Prisma.Decimal; calculationConfig: Prisma.JsonValue; mentionConfig: Prisma.JsonValue }) {
    return { ...rule, maximumScore: rule.maximumScore.toFixed(2), calculationConfig: rule.calculationConfig, mentionConfig: rule.mentionConfig };
  }
}

type CalculationConfig = { formula: 'WEIGHTED_SUBJECT_PERCENT' | 'WEIGHTED_RAW_SCORE'; rankByAverage: boolean };
type MentionConfig = { thresholds: Array<{ minimum: number; label: string }> };