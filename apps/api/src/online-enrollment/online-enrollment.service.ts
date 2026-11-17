import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { EnrollmentStatus, OnlineEnrollmentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { TenantContextService } from '../database/tenant-context.service';
import { ReviewOnlineEnrollmentDto, SubmitOnlineEnrollmentDto } from './online-enrollment.dto';
import { OnlineEnrollmentMailerService } from './online-enrollment-mailer.service';

const requestInclude = {
  requestedClass: { include: { level: true, schoolYear: true } },
  convertedStudent: { select: { id: true, matricule: true } },
} satisfies Prisma.OnlineEnrollmentRequestInclude;

@Injectable()
export class OnlineEnrollmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly mailer: OnlineEnrollmentMailerService,
  ) {}

  async getPublicForm(schoolSlug: string) {
    const school = await this.findActiveSchool(schoolSlug);
    return this.tenantContext.run({ schoolId: school.id }, async () => {
      const [profile, schoolYears] = await Promise.all([
        this.prisma.schoolProfile.findUnique({ where: { schoolId: school.id }, select: { name: true, shortName: true, city: true, phone: true, email: true, logoDataUrl: true } }),
        this.prisma.schoolYear.findMany({
          where: { isCurrent: true },
          select: {
            id: true,
            name: true,
            classes: {
              where: { isActive: true, level: { isActive: true } },
              select: { id: true, name: true, level: { select: { name: true } } },
              orderBy: [{ level: { sortOrder: 'asc' } }, { name: 'asc' }],
            },
          },
          orderBy: { startsOn: 'desc' },
        }),
      ]);
      return {
        school: { slug: school.slug, name: profile?.name ?? school.name, shortName: profile?.shortName ?? school.name, city: profile?.city ?? null, phone: profile?.phone ?? null, email: profile?.email ?? null, logoDataUrl: profile?.logoDataUrl ?? null },
        schoolYears: schoolYears.map(({ classes, ...year }) => ({ ...year, classes })),
      };
    });
  }

  async submitPublicRequest(schoolSlug: string, dto: SubmitOnlineEnrollmentDto) {
    const school = await this.findActiveSchool(schoolSlug);
    return this.tenantContext.run({ schoolId: school.id }, async () => {
      const schoolClass = await this.prisma.schoolClass.findFirst({
        where: { id: dto.classId, isActive: true, level: { isActive: true }, schoolYear: { isCurrent: true } },
        include: { level: { select: { name: true } } },
      });
      if (!schoolClass) throw new BadRequestException('La classe sélectionnée n’est pas ouverte aux demandes en ligne.');
      const request = await this.prisma.onlineEnrollmentRequest.create({
        data: {
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
          sex: dto.sex ?? null,
          requestedClassId: schoolClass.id,
          guardianFirstName: dto.guardianFirstName.trim(),
          guardianLastName: dto.guardianLastName.trim(),
          guardianPhone: dto.guardianPhone.trim(),
          guardianEmail: dto.guardianEmail?.trim().toLowerCase() || null,
          guardianAddress: dto.guardianAddress?.trim() || null,
          relationship: dto.relationship.trim(),
        },
        include: requestInclude,
      });
      await this.audit('ONLINE_ENROLLMENT_SUBMITTED', request.id, { requestedClassId: schoolClass.id });
      const delivery = await this.mailer.notify(request, school.name, `${schoolClass.level.name} ${schoolClass.name}`);
      return { id: request.id, status: request.status, createdAt: request.createdAt, notificationSent: delivery === 'sent' };
    });
  }

  async notifyRequest(id: string) {
    const request = await this.prisma.onlineEnrollmentRequest.findUnique({ where: { id }, include: requestInclude });
    if (!request) throw new NotFoundException('Demande d’inscription introuvable.');
    const schoolId = this.tenantContext.schoolId();
    if (!schoolId) throw new Error('Tenant context is required to send an enrollment notification.');
    const profile = await this.prisma.schoolProfile.findUnique({ where: { schoolId }, select: { name: true } });
    const delivery = await this.mailer.notify(
      request,
      profile?.name ?? 'votre établissement',
      `${request.requestedClass.level.name} ${request.requestedClass.name}`,
    );
    if (delivery !== 'sent') {
      throw new ServiceUnavailableException(
        delivery === 'not-configured'
          ? 'Configurez le serveur SMTP et l’adresse de notification dans .env avant de renvoyer l’e-mail.'
          : 'L’e-mail n’a pas pu être envoyé. Vérifiez la configuration SMTP du serveur.',
      );
    }
    await this.prisma.auditLog.create({
      data: {
        action: 'ONLINE_ENROLLMENT_NOTIFICATION_SENT',
        entityType: 'OnlineEnrollmentRequest',
        entityId: request.id,
        details: { recipientConfigured: true },
      },
    });
    return { notificationSent: true };
  }

  listRequests() {
    return this.prisma.onlineEnrollmentRequest.findMany({
      include: requestInclude,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 500,
    });
  }

  async reviewRequest(id: string, dto: ReviewOnlineEnrollmentDto) {
    if (dto.status !== OnlineEnrollmentStatus.ACCEPTED && dto.status !== OnlineEnrollmentStatus.REJECTED) {
      throw new BadRequestException('Choisissez Accepter ou Refuser pour examiner une demande.');
    }
    return this.prisma.$transaction(async (transaction) => {
      const request = await transaction.onlineEnrollmentRequest.findUnique({ where: { id } });
      if (!request) throw new NotFoundException('Demande d’inscription introuvable.');
      if (request.status !== OnlineEnrollmentStatus.PENDING) throw new BadRequestException('Cette demande a déjà été examinée.');
      const updatedCount = await transaction.onlineEnrollmentRequest.updateMany({
        where: { id, status: OnlineEnrollmentStatus.PENDING },
        data: { status: dto.status, reviewNote: dto.reviewNote?.trim() || null, reviewedAt: new Date() },
      });
      if (updatedCount.count !== 1) throw new BadRequestException('Cette demande vient d’être examinée.');
      const updated = await transaction.onlineEnrollmentRequest.findUniqueOrThrow({ where: { id }, include: requestInclude });
      await transaction.auditLog.create({
        data: {
          action: dto.status === OnlineEnrollmentStatus.ACCEPTED ? 'ONLINE_ENROLLMENT_ACCEPTED' : 'ONLINE_ENROLLMENT_REJECTED',
          entityType: 'OnlineEnrollmentRequest',
          entityId: id,
          details: { requestedClassId: request.requestedClassId, hasReviewNote: Boolean(dto.reviewNote?.trim()) },
        },
      });
      return updated;
    });
  }

  async enrollRequest(id: string) {
    return this.prisma.$transaction(async (transaction) => {
      const request = await transaction.onlineEnrollmentRequest.findUnique({ where: { id } });
      if (!request) throw new NotFoundException('Demande d’inscription introuvable.');
      if (request.status !== OnlineEnrollmentStatus.ACCEPTED || request.convertedStudentId) {
        throw new BadRequestException('Seule une demande acceptée et non convertie peut créer un dossier élève.');
      }

      const schoolClass = await transaction.schoolClass.findFirst({
        where: { id: request.requestedClassId, isActive: true, level: { isActive: true }, schoolYear: { isCurrent: true } },
      });
      if (!schoolClass) throw new BadRequestException('La classe demandée n’est plus disponible. Modifiez la classe avant de convertir la demande.');
      const claimed = await transaction.onlineEnrollmentRequest.updateMany({
        where: { id, status: OnlineEnrollmentStatus.ACCEPTED, convertedStudentId: null },
        data: { status: OnlineEnrollmentStatus.ENROLLED },
      });
      if (claimed.count !== 1) throw new BadRequestException('Cette demande vient déjà d’être convertie.');

      const matricule = this.generateMatricule();
      const student = await transaction.student.create({
        data: {
          matricule,
          firstName: request.firstName,
          lastName: request.lastName,
          dateOfBirth: request.dateOfBirth,
          sex: request.sex,
        },
      });
      const guardian = await transaction.guardian.create({
        data: {
          firstName: request.guardianFirstName,
          lastName: request.guardianLastName,
          phone: request.guardianPhone,
          email: request.guardianEmail,
          address: request.guardianAddress,
        },
      });
      await transaction.studentGuardian.create({
        data: { studentId: student.id, guardianId: guardian.id, relationship: request.relationship, isPrimary: true },
      });
      await transaction.enrollment.create({
        data: { studentId: student.id, classId: schoolClass.id, status: EnrollmentStatus.ACTIVE },
      });
      const converted = await transaction.onlineEnrollmentRequest.update({
        where: { id },
        data: { status: OnlineEnrollmentStatus.ENROLLED, convertedStudentId: student.id },
        include: requestInclude,
      });
      await transaction.auditLog.create({
        data: {
          action: 'ONLINE_ENROLLMENT_CONVERTED',
          entityType: 'OnlineEnrollmentRequest',
          entityId: id,
          details: { studentId: student.id, matricule, guardianId: guardian.id, classId: schoolClass.id },
        },
      });
      return converted;
    });
  }

  private async findActiveSchool(schoolSlug: string) {
    const school = await this.prisma.school.findUnique({ where: { slug: schoolSlug.trim().toLowerCase() } });
    if (!school?.isActive) throw new NotFoundException('Établissement introuvable ou inactif.');
    return school;
  }

  private generateMatricule() {
    const year = new Date().getFullYear().toString().slice(-2);
    return `NE-${year}-${randomBytes(4).toString('hex').toUpperCase()}`;
  }

  private audit(action: string, entityId: string, details: Prisma.InputJsonObject) {
    return this.prisma.auditLog.create({ data: { action, entityType: 'OnlineEnrollmentRequest', entityId, details } });
  }
}
