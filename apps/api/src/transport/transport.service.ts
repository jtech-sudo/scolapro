import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EnrollmentStatus, Prisma, TransportDirection } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { TenantContextService } from '../database/tenant-context.service';
import { AssignTransportStudentDto, CreateTransportRouteDto, CreateTransportStopDto, UpdateTransportRouteDto } from './transport.dto';

const routeInclude = {
  stops: { orderBy: { order: 'asc' as const } },
  students: {
    where: { isActive: true },
    include: {
      student: { select: { id: true, matricule: true, firstName: true, lastName: true } },
      stop: { select: { id: true, name: true, order: true, arrivalTime: true } },
    },
    orderBy: { student: { lastName: 'asc' as const } },
  },
} satisfies Prisma.TransportRouteInclude;

@Injectable()
export class TransportService {
  constructor(private readonly prisma: PrismaService, private readonly tenantContext: TenantContextService) {}

  listRoutes() {
    return this.prisma.transportRoute.findMany({
      include: routeInclude,
      orderBy: [{ isActive: 'desc' }, { direction: 'asc' }, { name: 'asc' }],
      take: 200,
    });
  }

  async listStudents() {
    const students = await this.prisma.student.findMany({
      where: { isActive: true, enrollments: { some: { status: EnrollmentStatus.ACTIVE } } },
      select: {
        id: true,
        matricule: true,
        firstName: true,
        lastName: true,
        enrollments: {
          where: { status: EnrollmentStatus.ACTIVE },
          select: { schoolClass: { select: { name: true, level: { select: { name: true } }, schoolYear: { select: { name: true, isCurrent: true } } } } },
          orderBy: { enrolledAt: 'desc' },
          take: 1,
        },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      take: 1000,
    });
    return students.map(({ enrollments, ...student }) => ({
      ...student,
      enrollment: enrollments[0]?.schoolClass ?? null,
    }));
  }

  async createRoute(dto: CreateTransportRouteDto) {
    const name = dto.name.trim();
    const existing = await this.prisma.transportRoute.findFirst({ where: { name, direction: dto.direction } });
    if (existing) throw new ConflictException('Une ligne portant ce nom existe déjà pour ce trajet.');

    const route = await this.prisma.transportRoute.create({
      data: {
        name,
        direction: dto.direction,
        vehicle: dto.vehicle?.trim() || null,
        vehiclePlate: dto.vehiclePlate?.trim() || null,
        driverName: dto.driverName?.trim() || null,
        capacity: dto.capacity,
      },
      include: routeInclude,
    });
    await this.audit('TRANSPORT_ROUTE_CREATED', route.id, { name, direction: dto.direction, capacity: dto.capacity });
    return route;
  }

  async updateRoute(id: string, dto: UpdateTransportRouteDto) {
    const existing = await this.prisma.transportRoute.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Ligne de transport introuvable.');
    const passengerCount = await this.prisma.transportStudent.count({ where: { routeId: id, isActive: true } });
    if (dto.capacity !== undefined && dto.capacity < passengerCount) {
      throw new BadRequestException('La capacité ne peut pas être inférieure au nombre d’élèves affectés.');
    }

    const route = await this.prisma.transportRoute.update({
      where: { id },
      data: {
        ...(dto.vehicle !== undefined ? { vehicle: dto.vehicle?.trim() || null } : {}),
        ...(dto.vehiclePlate !== undefined ? { vehiclePlate: dto.vehiclePlate?.trim() || null } : {}),
        ...(dto.driverName !== undefined ? { driverName: dto.driverName?.trim() || null } : {}),
        ...(dto.capacity !== undefined ? { capacity: dto.capacity } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      include: routeInclude,
    });
    await this.audit(dto.isActive === false ? 'TRANSPORT_ROUTE_ARCHIVED' : 'TRANSPORT_ROUTE_UPDATED', id, { changedFields: Object.keys(dto) });
    return route;
  }

  async addStop(routeId: string, dto: CreateTransportStopDto) {
    const route = await this.prisma.transportRoute.findUnique({ where: { id: routeId } });
    if (!route || !route.isActive) throw new NotFoundException('Ligne active introuvable.');
    const stopCount = await this.prisma.transportStop.count({ where: { routeId } });
    const stop = await this.prisma.transportStop.create({
      data: { routeId, name: dto.name.trim(), order: stopCount + 1, arrivalTime: dto.arrivalTime ?? null },
    });
    await this.audit('TRANSPORT_STOP_CREATED', stop.id, { routeId, name: stop.name, order: stop.order });
    return stop;
  }

  async assignStudent(routeId: string, dto: AssignTransportStudentDto) {
    return this.prisma.$transaction(async (transaction) => {
      const route = await transaction.transportRoute.findUnique({ where: { id: routeId } });
      if (!route || !route.isActive) throw new NotFoundException('Ligne active introuvable.');
      const student = await transaction.student.findFirst({ where: { id: dto.studentId, isActive: true } });
      if (!student) throw new NotFoundException('Élève actif introuvable.');
      if (dto.stopId) {
        const stop = await transaction.transportStop.findFirst({ where: { id: dto.stopId, routeId } });
        if (!stop) throw new BadRequestException('L’arrêt sélectionné n’appartient pas à cette ligne.');
      }

      const otherAssignment = await transaction.transportStudent.findFirst({
        where: {
          studentId: student.id,
          isActive: true,
          routeId: { not: routeId },
          route: { direction: route.direction, isActive: true },
        },
      });
      if (otherAssignment) throw new ConflictException('Cet élève est déjà affecté à une autre ligne dans cette direction.');

      const schoolId = this.tenantContext.schoolId();
      if (!schoolId) throw new Error('Tenant context is required for transport assignment.');
      const existing = await transaction.transportStudent.findUnique({
        where: { schoolId_routeId_studentId: { schoolId, routeId, studentId: student.id } },
      });
      if (existing?.isActive) throw new ConflictException('Cet élève est déjà affecté à cette ligne.');

      const passengerCount = await transaction.transportStudent.count({ where: { routeId, isActive: true } });
      if (passengerCount >= route.capacity) throw new BadRequestException('La capacité de cette ligne est atteinte.');

      const assignment = existing
        ? await transaction.transportStudent.update({
          where: { id: existing.id },
          data: { isActive: true, stopId: dto.stopId ?? null },
          include: { student: { select: { id: true, matricule: true, firstName: true, lastName: true } }, stop: true },
        })
        : await transaction.transportStudent.create({
          data: { routeId, studentId: student.id, stopId: dto.stopId ?? null },
          include: { student: { select: { id: true, matricule: true, firstName: true, lastName: true } }, stop: true },
        });
      await transaction.auditLog.create({
        data: { action: 'TRANSPORT_STUDENT_ASSIGNED', entityType: 'TransportStudent', entityId: assignment.id, details: { routeId, studentId: student.id, stopId: dto.stopId ?? null } },
      });
      return assignment;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async unassignStudent(routeId: string, studentId: string) {
    const assignment = await this.prisma.transportStudent.findFirst({ where: { routeId, studentId, isActive: true } });
    if (!assignment) throw new NotFoundException('Affectation de transport introuvable.');
    await this.prisma.transportStudent.update({ where: { id: assignment.id }, data: { isActive: false } });
    await this.audit('TRANSPORT_STUDENT_UNASSIGNED', assignment.id, { routeId, studentId });
    return { unassigned: true };
  }

  private audit(action: string, entityId: string, details: Prisma.InputJsonObject) {
    return this.prisma.auditLog.create({ data: { action, entityType: 'Transport', entityId, details } });
  }
}
