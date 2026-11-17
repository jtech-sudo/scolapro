import { randomBytes } from 'node:crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import {
  CancelPaymentDto,
  CreateFeeTypeDto,
  CreateInstallmentDto,
  CreateInvoiceDto,
  CreatePaymentDto,
  ListInvoicesDto,
  ListPaymentsDto,
  UpdateFeeTypeDto,
} from './billing.dto';

const invoiceInclude = {
  student: true,
  feeType: true,
  schoolYear: true,
  installments: { orderBy: { dueDate: 'asc' as const } },
  allocations: {
    include: { payment: true },
    orderBy: { payment: { receivedAt: 'desc' as const } },
  },
} satisfies Prisma.InvoiceInclude;

@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}

  listFeeTypes() {
    return this.prisma.feeType.findMany({
      include: { _count: { select: { invoices: true } } },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
  }

  async createFeeType(dto: CreateFeeTypeDto) {
    const feeType = await this.prisma.feeType.create({
      data: { name: dto.name.trim(), description: dto.description?.trim() || null },
    });
    await this.audit('FEE_TYPE_CREATED', 'FeeType', feeType.id, { name: feeType.name });
    return feeType;
  }

  async updateFeeType(id: string, dto: UpdateFeeTypeDto) {
    const feeType = await this.prisma.feeType.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      include: { _count: { select: { invoices: true } } },
    });
    await this.audit('FEE_TYPE_UPDATED', 'FeeType', id, { changedFields: Object.keys(dto) });
    return feeType;
  }

  async listInvoices(query: ListInvoicesDto) {
    const where: Prisma.InvoiceWhereInput = {
      ...(query.schoolYearId ? { schoolYearId: query.schoolYearId } : {}),
      ...(query.studentId ? { studentId: query.studentId } : {}),
      ...(query.search?.trim()
        ? { OR: [
            { invoiceNumber: { contains: query.search.trim(), mode: 'insensitive' } },
            { student: { firstName: { contains: query.search.trim(), mode: 'insensitive' } } },
            { student: { lastName: { contains: query.search.trim(), mode: 'insensitive' } } },
            { student: { matricule: { contains: query.search.trim(), mode: 'insensitive' } } },
          ] }
        : {}),
    };
    const invoices = await this.prisma.invoice.findMany({
      where,
      include: invoiceInclude,
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    });
    return invoices.map((invoice) => this.withBalance(invoice));
  }

  async createInvoice(dto: CreateInvoiceDto) {
    const amountDue = new Prisma.Decimal(dto.amountDue);
    if (amountDue.lte(0)) throw new BadRequestException('Le montant de la facture doit être supérieur à zéro.');
    const [student, feeType, schoolYear] = await Promise.all([
      this.prisma.student.findUnique({ where: { id: dto.studentId } }),
      this.prisma.feeType.findUnique({ where: { id: dto.feeTypeId } }),
      this.prisma.schoolYear.findUnique({ where: { id: dto.schoolYearId } }),
    ]);
    if (!student || !student.isActive) throw new BadRequestException('L’élève est introuvable ou archivé.');
    if (!feeType || !feeType.isActive) throw new BadRequestException('Le type de frais est introuvable ou archivé.');
    if (!schoolYear) throw new BadRequestException('L’année scolaire est introuvable.');

    const isEnrolled = await this.prisma.enrollment.findFirst({
      where: { studentId: student.id, status: 'ACTIVE', schoolClass: { schoolYearId: schoolYear.id } },
    });
    if (!isEnrolled) throw new BadRequestException('L’élève n’est pas inscrit dans cette année scolaire.');

    const invoice = await this.prisma.invoice.create({
      data: {
        invoiceNumber: this.makeInvoiceNumber(),
        studentId: dto.studentId,
        feeTypeId: dto.feeTypeId,
        schoolYearId: dto.schoolYearId,
        amountDue,
        ...(dto.dueDate ? { dueDate: new Date(dto.dueDate) } : {}),
      },
      include: invoiceInclude,
    });
    await this.audit('INVOICE_CREATED', 'Invoice', invoice.id, { invoiceNumber: invoice.invoiceNumber, amountDue: amountDue.toFixed(2), schoolYearId: schoolYear.id });
    return this.withBalance(invoice);
  }

  async addInstallment(invoiceId: string, dto: CreateInstallmentDto) {
    const amount = new Prisma.Decimal(dto.amount);
    if (amount.lte(0)) throw new BadRequestException('Le montant de l’échéance doit être supérieur à zéro.');

    const installment = await this.prisma.$transaction(async (transaction) => {
      const invoice = await transaction.invoice.findUnique({ where: { id: invoiceId }, include: { installments: true } });
      if (!invoice) throw new NotFoundException('Facture introuvable.');
      const existingPlan = invoice.installments.reduce((sum, item) => sum.plus(item.amount), new Prisma.Decimal(0));
      if (existingPlan.plus(amount).gt(invoice.amountDue)) {
        throw new BadRequestException('Le total des échéances dépasserait le montant facturé.');
      }
      const created = await transaction.invoiceInstallment.create({
        data: { invoiceId, label: dto.label.trim(), amount, dueDate: new Date(dto.dueDate) },
      });
      await transaction.auditLog.create({ data: { action: 'INVOICE_INSTALLMENT_CREATED', entityType: 'InvoiceInstallment', entityId: created.id, details: { invoiceId, amount: amount.toFixed(2) } } });
      return created;
    });
    return installment;
  }

  async createPayment(dto: CreatePaymentDto) {
    const amount = new Prisma.Decimal(dto.amount);
    if (amount.lte(0)) throw new BadRequestException('Le montant du paiement doit être supérieur à zéro.');
    if (new Set(dto.allocations.map((item) => item.invoiceId)).size !== dto.allocations.length) {
      throw new BadRequestException('Une facture ne peut apparaître qu’une seule fois dans la répartition du paiement.');
    }
    const allocations = dto.allocations.map((item) => ({ invoiceId: item.invoiceId, amount: new Prisma.Decimal(item.amount) }));
    if (allocations.some((allocation) => allocation.amount.lte(0))) throw new BadRequestException('Chaque montant affecté doit être supérieur à zéro.');
    const allocationTotal = allocations.reduce((sum, allocation) => sum.plus(allocation.amount), new Prisma.Decimal(0));
    if (!allocationTotal.equals(amount)) throw new BadRequestException('La somme répartie doit être égale au montant encaissé.');

    return this.prisma.$transaction(async (transaction) => {
      const invoices = await transaction.invoice.findMany({
        where: { id: { in: allocations.map((item) => item.invoiceId) } },
        include: { allocations: { where: { payment: { status: PaymentStatus.RECORDED } } } },
      });
      if (invoices.length !== allocations.length) throw new BadRequestException('Une ou plusieurs factures sélectionnées n’existent pas.');

      for (const allocation of allocations) {
        const invoice = invoices.find((item) => item.id === allocation.invoiceId)!;
        const alreadyPaid = invoice.allocations.reduce((sum, item) => sum.plus(item.amount), new Prisma.Decimal(0));
        const remaining = invoice.amountDue.minus(alreadyPaid);
        if (allocation.amount.gt(remaining)) {
          throw new BadRequestException(`Le paiement dépasse le solde de la facture ${invoice.invoiceNumber}. Solde : ${remaining.toFixed(2)}.`);
        }
      }

      const payment = await transaction.payment.create({
        data: {
          receiptNumber: this.makeReceiptNumber(),
          amount,
          method: dto.method.trim(),
          ...(dto.providerReference?.trim() ? { providerReference: dto.providerReference.trim() } : {}),
          receivedAt: dto.receivedAt ? new Date(dto.receivedAt) : new Date(),
          recordedById: dto.recordedById?.trim() || 'local-demo',
          allocations: { create: allocations.map((allocation) => ({ invoiceId: allocation.invoiceId, amount: allocation.amount })) },
        },
        include: {
          allocations: { include: { invoice: { include: { student: true, feeType: true, schoolYear: true } } } },
        },
      });
      await transaction.auditLog.create({
        data: { action: 'PAYMENT_RECORDED', entityType: 'Payment', entityId: payment.id, details: { receiptNumber: payment.receiptNumber, amount: amount.toFixed(2), allocationCount: allocations.length } },
      });
      return payment;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async listPayments(query: ListPaymentsDto) {
    const payments = await this.prisma.payment.findMany({
      where: query.schoolYearId || query.studentId
        ? {
            allocations: {
              some: {
                invoice: {
                  ...(query.schoolYearId ? { schoolYearId: query.schoolYearId } : {}),
                  ...(query.studentId ? { studentId: query.studentId } : {}),
                },
              },
            },
          }
        : {},
      include: { allocations: { include: { invoice: { include: { student: true, feeType: true, schoolYear: true } } } } },
      orderBy: { receivedAt: 'desc' },
    });
    return payments.map((payment) => ({
      ...payment,
      amount: payment.amount.toFixed(2),
      allocations: payment.allocations.map((allocation) => ({ ...allocation, amount: allocation.amount.toFixed(2) })),
    }));
  }

  async cancelPayment(id: string, dto: CancelPaymentDto) {
    return this.prisma.$transaction(async (transaction) => {
      const payment = await transaction.payment.findUnique({ where: { id } });
      if (!payment) throw new NotFoundException('Paiement introuvable.');
      if (payment.status !== PaymentStatus.RECORDED) throw new BadRequestException('Ce paiement est déjà annulé ou remboursé.');
      const cancelled = await transaction.payment.update({
        where: { id },
        data: { status: PaymentStatus.CANCELLED, cancelledAt: new Date(), cancellationReason: dto.reason.trim() },
        include: { allocations: { include: { invoice: { include: { student: true, feeType: true, schoolYear: true } } } } },
      });
      await transaction.auditLog.create({ data: { action: 'PAYMENT_CANCELLED', entityType: 'Payment', entityId: id, details: { receiptNumber: payment.receiptNumber, reason: dto.reason.trim() } } });
      return cancelled;
    });
  }

  async getReceipt(id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: { allocations: { include: { invoice: { include: { student: true, feeType: true, schoolYear: true } } } } },
    });
    if (!payment) throw new NotFoundException('Reçu introuvable.');
    return {
      receiptNumber: payment.receiptNumber,
      receivedAt: payment.receivedAt,
      amount: payment.amount.toFixed(2),
      method: payment.method,
      providerReference: payment.providerReference,
      status: payment.status,
      cancellationReason: payment.cancellationReason,
      allocations: payment.allocations.map((allocation) => ({
        amount: allocation.amount.toFixed(2),
        invoiceNumber: allocation.invoice.invoiceNumber,
        studentName: `${allocation.invoice.student.firstName} ${allocation.invoice.student.lastName}`,
        matricule: allocation.invoice.student.matricule,
        feeName: allocation.invoice.feeType.name,
        schoolYear: allocation.invoice.schoolYear.name,
      })),
    };
  }

  async getSummary(schoolYearId?: string) {
    const where: Prisma.InvoiceWhereInput = schoolYearId ? { schoolYearId } : {};
    const invoices = await this.prisma.invoice.findMany({ where, include: { allocations: { where: { payment: { status: PaymentStatus.RECORDED } } } } });
    const totalInvoiced = invoices.reduce((sum, invoice) => sum.plus(invoice.amountDue), new Prisma.Decimal(0));
    const totalPaid = invoices.reduce((sum, invoice) => sum.plus(invoice.allocations.reduce((paid, allocation) => paid.plus(allocation.amount), new Prisma.Decimal(0))), new Prisma.Decimal(0));
    return {
      invoiceCount: invoices.length,
      totalInvoiced: totalInvoiced.toFixed(2),
      totalPaid: totalPaid.toFixed(2),
      totalBalance: totalInvoiced.minus(totalPaid).toFixed(2),
      unpaidInvoiceCount: invoices.filter((invoice) => invoice.amountDue.gt(invoice.allocations.reduce((sum, allocation) => sum.plus(allocation.amount), new Prisma.Decimal(0)))).length,
      currency: 'XOF',
    };
  }

  private withBalance<T extends { amountDue: Prisma.Decimal; allocations: Array<{ amount: Prisma.Decimal; payment: { status: PaymentStatus } }> }>(invoice: T) {
    const paid = invoice.allocations
      .filter((allocation) => allocation.payment.status === PaymentStatus.RECORDED)
      .reduce((sum, allocation) => sum.plus(allocation.amount), new Prisma.Decimal(0));
    const balance = invoice.amountDue.minus(paid);
    return {
      ...invoice,
      amountDue: invoice.amountDue.toFixed(2),
      amountPaid: paid.toFixed(2),
      balance: balance.toFixed(2),
      status: balance.lte(0) ? 'PAID' : paid.gt(0) ? 'PARTIAL' : 'UNPAID',
      allocations: invoice.allocations.map((allocation) => ({ ...allocation, amount: allocation.amount.toFixed(2) })),
    };
  }

  private makeInvoiceNumber() {
    return `FAC-${new Date().getFullYear()}-${randomBytes(4).toString('hex').toUpperCase()}`;
  }

  private makeReceiptNumber() {
    return `REC-${new Date().getFullYear()}-${randomBytes(4).toString('hex').toUpperCase()}`;
  }

  private audit(action: string, entityType: string, entityId: string, details?: Prisma.InputJsonObject) {
    return this.prisma.auditLog.create({ data: { action, entityType, entityId, ...(details ? { details } : {}) } });
  }
}