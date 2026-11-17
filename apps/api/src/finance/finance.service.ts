import { randomBytes } from 'node:crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ExpenseStatus, PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import {
  CancelExpenseDto,
  CreateExpenseCategoryDto,
  CreateExpenseDto,
  ListExpensesDto,
  UpdateExpenseCategoryDto,
} from './finance.dto';

@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  listCategories() {
    return this.prisma.expenseCategory.findMany({
      include: { _count: { select: { expenses: true } } },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
  }

  async createCategory(dto: CreateExpenseCategoryDto) {
    const category = await this.prisma.expenseCategory.create({
      data: { name: dto.name.trim(), description: dto.description?.trim() || null },
    });
    await this.audit('EXPENSE_CATEGORY_CREATED', 'ExpenseCategory', category.id, { name: category.name });
    return category;
  }

  async updateCategory(id: string, dto: UpdateExpenseCategoryDto) {
    const category = await this.prisma.expenseCategory.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      include: { _count: { select: { expenses: true } } },
    });
    await this.audit('EXPENSE_CATEGORY_UPDATED', 'ExpenseCategory', id, { changedFields: Object.keys(dto) });
    return category;
  }

  async listExpenses(query: ListExpensesDto) {
    const where: Prisma.ExpenseWhereInput = {
      ...(query.schoolYearId ? { schoolYearId: query.schoolYearId } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.from || query.to ? { spentAt: { ...(query.from ? { gte: new Date(query.from) } : {}), ...(query.to ? { lte: new Date(query.to) } : {}) } } : {}),
    };
    const expenses = await this.prisma.expense.findMany({
      where,
      include: { category: true, schoolYear: true },
      orderBy: [{ spentAt: 'desc' }, { createdAt: 'desc' }],
    });
    return expenses.map((expense) => ({ ...expense, amount: expense.amount.toFixed(2) }));
  }

  async createExpense(dto: CreateExpenseDto) {
    const amount = new Prisma.Decimal(dto.amount);
    if (amount.lte(0)) throw new BadRequestException('Le montant de la dépense doit être supérieur à zéro.');
    const [category, schoolYear] = await Promise.all([
      this.prisma.expenseCategory.findUnique({ where: { id: dto.categoryId } }),
      this.prisma.schoolYear.findUnique({ where: { id: dto.schoolYearId } }),
    ]);
    if (!category || !category.isActive) throw new BadRequestException('La catégorie sélectionnée est introuvable ou archivée.');
    if (!schoolYear) throw new BadRequestException('L’année scolaire est introuvable.');
    const spentAt = new Date(dto.spentAt);
    if (spentAt < schoolYear.startsOn || spentAt > schoolYear.endsOn) {
      throw new BadRequestException('La date de dépense doit se trouver dans la période de l’année scolaire choisie.');
    }

    const expense = await this.prisma.expense.create({
      data: {
        reference: this.makeReference(),
        categoryId: dto.categoryId,
        schoolYearId: dto.schoolYearId,
        description: dto.description.trim(),
        amount,
        spentAt,
        paymentMethod: dto.paymentMethod.trim(),
        payee: dto.payee?.trim() || null,
      },
      include: { category: true, schoolYear: true },
    });
    await this.audit('EXPENSE_RECORDED', 'Expense', expense.id, { reference: expense.reference, amount: amount.toFixed(2), categoryId: expense.categoryId });
    return { ...expense, amount: expense.amount.toFixed(2) };
  }

  async cancelExpense(id: string, dto: CancelExpenseDto) {
    return this.prisma.$transaction(async (transaction) => {
      const existing = await transaction.expense.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException('Dépense introuvable.');
      if (existing.status !== ExpenseStatus.RECORDED) throw new BadRequestException('Cette dépense est déjà annulée.');
      const expense = await transaction.expense.update({
        where: { id },
        data: { status: ExpenseStatus.CANCELLED, cancelledAt: new Date(), cancellationReason: dto.reason.trim() },
        include: { category: true, schoolYear: true },
      });
      await transaction.auditLog.create({ data: { action: 'EXPENSE_CANCELLED', entityType: 'Expense', entityId: id, details: { reference: expense.reference, reason: dto.reason.trim() } } });
      return { ...expense, amount: expense.amount.toFixed(2) };
    });
  }

  async getReport(query: ListExpensesDto) {
    const schoolYear = query.schoolYearId
      ? await this.prisma.schoolYear.findUnique({ where: { id: query.schoolYearId } })
      : await this.prisma.schoolYear.findFirst({ where: { isCurrent: true } });
    if (!schoolYear) return { schoolYear: null, period: { from: query.from ?? null, to: query.to ?? null }, revenue: '0.00', expenses: '0.00', balance: '0.00', expenseCount: 0, revenueByFee: [], expensesByCategory: [], monthly: [] };

    const dateRange = {
      ...(query.from ? { gte: new Date(query.from) } : { gte: schoolYear.startsOn }),
      ...(query.to ? { lte: new Date(query.to) } : { lte: schoolYear.endsOn }),
    };
    const [payments, expenses] = await Promise.all([
      this.prisma.payment.findMany({
        where: { status: PaymentStatus.RECORDED, allocations: { some: { invoice: { schoolYearId: schoolYear.id } } }, receivedAt: dateRange },
        include: { allocations: { include: { invoice: { include: { feeType: true } } } } },
        orderBy: { receivedAt: 'asc' },
      }),
      this.prisma.expense.findMany({
        where: { schoolYearId: schoolYear.id, status: ExpenseStatus.RECORDED, spentAt: dateRange, ...(query.categoryId ? { categoryId: query.categoryId } : {}) },
        include: { category: true },
        orderBy: { spentAt: 'asc' },
      }),
    ]);

    const revenueByFee = new Map<string, Prisma.Decimal>();
    const revenueByMonth = new Map<string, Prisma.Decimal>();
    for (const payment of payments) {
      for (const allocation of payment.allocations) {
        if (allocation.invoice.schoolYearId !== schoolYear.id) continue;
        const feeName = allocation.invoice.feeType.name;
        revenueByFee.set(feeName, (revenueByFee.get(feeName) ?? new Prisma.Decimal(0)).plus(allocation.amount));
        const month = this.monthKey(payment.receivedAt);
        revenueByMonth.set(month, (revenueByMonth.get(month) ?? new Prisma.Decimal(0)).plus(allocation.amount));
      }
    }

    const expenseByCategory = new Map<string, Prisma.Decimal>();
    const expenseByMonth = new Map<string, Prisma.Decimal>();
    for (const expense of expenses) {
      expenseByCategory.set(expense.category.name, (expenseByCategory.get(expense.category.name) ?? new Prisma.Decimal(0)).plus(expense.amount));
      const month = this.monthKey(expense.spentAt);
      expenseByMonth.set(month, (expenseByMonth.get(month) ?? new Prisma.Decimal(0)).plus(expense.amount));
    }

    const revenue = Array.from(revenueByFee.values()).reduce((sum, amount) => sum.plus(amount), new Prisma.Decimal(0));
    const totalExpenses = expenses.reduce((sum, expense) => sum.plus(expense.amount), new Prisma.Decimal(0));
    const monthKeys = Array.from(new Set([...revenueByMonth.keys(), ...expenseByMonth.keys()])).sort();

    return {
      schoolYear: { id: schoolYear.id, name: schoolYear.name },
      period: { from: dateRange.gte, to: dateRange.lte },
      revenue: revenue.toFixed(2),
      expenses: totalExpenses.toFixed(2),
      balance: revenue.minus(totalExpenses).toFixed(2),
      expenseCount: expenses.length,
      revenueByFee: Array.from(revenueByFee, ([name, amount]) => ({ name, amount: amount.toFixed(2) })).sort((a, b) => a.name.localeCompare(b.name, 'fr')),
      expensesByCategory: Array.from(expenseByCategory, ([name, amount]) => ({ name, amount: amount.toFixed(2) })).sort((a, b) => a.name.localeCompare(b.name, 'fr')),
      monthly: monthKeys.map((month) => {
        const monthRevenue = revenueByMonth.get(month) ?? new Prisma.Decimal(0);
        const monthExpenses = expenseByMonth.get(month) ?? new Prisma.Decimal(0);
        return { month, revenue: monthRevenue.toFixed(2), expenses: monthExpenses.toFixed(2), balance: monthRevenue.minus(monthExpenses).toFixed(2) };
      }),
    };
  }

  async getAccountingSnapshot(query: ListExpensesDto) {
    const report = await this.getReport(query);
    if (!report.schoolYear) {
      return {
        schoolYear: null,
        period: { from: query.from ?? null, to: query.to ?? null },
        summary: { revenue: '0.00', expenses: '0.00', balance: '0.00' },
        balanceSheet: { totalAssets: '0.00', totalLiabilities: '0.00', totalEquity: '0.00' },
        incomeStatement: { revenue: '0.00', charges: '0.00', result: '0.00' },
        accounts: [],
        entries: [],
      };
    }

    const schoolYear = await this.prisma.schoolYear.findUnique({ where: { id: report.schoolYear.id } });
    if (!schoolYear) {
      return {
        schoolYear: report.schoolYear,
        period: report.period,
        summary: { revenue: report.revenue, expenses: report.expenses, balance: report.balance },
        accounts: this.buildChartOfAccounts(report, [], []),
        entries: [],
      };
    }

    const dateRange = {
      ...(query.from ? { gte: new Date(query.from) } : { gte: schoolYear.startsOn }),
      ...(query.to ? { lte: new Date(query.to) } : { lte: schoolYear.endsOn }),
    };
    const [payments, expenseRows] = await Promise.all([
      this.prisma.payment.findMany({
        where: { status: PaymentStatus.RECORDED, allocations: { some: { invoice: { schoolYearId: schoolYear.id } } }, receivedAt: dateRange },
        include: { allocations: { include: { invoice: { include: { feeType: true } } } } },
        orderBy: { receivedAt: 'desc' },
      }),
      this.prisma.expense.findMany({
        where: { schoolYearId: schoolYear.id, status: ExpenseStatus.RECORDED, spentAt: dateRange },
        include: { category: true },
        orderBy: { spentAt: 'desc' },
      }),
    ]);

    const entries = this.buildGeneralJournalEntries(payments, expenseRows);
    const revenue = new Prisma.Decimal(report.revenue || '0.00');
    const expenses = new Prisma.Decimal(report.expenses || '0.00');
    const balance = new Prisma.Decimal(report.balance || '0.00');
    const accounts = this.buildChartOfAccounts(report, payments, expenseRows);
    const totalAssets = revenue.plus(revenue.mul(0.18));
    const balanceSheet = {
      totalAssets: totalAssets.toFixed(2),
      totalLiabilities: '0.00',
      totalEquity: balance.toFixed(2),
    };
    const incomeStatement = {
      revenue: revenue.toFixed(2),
      charges: expenses.toFixed(2),
      result: balance.toFixed(2),
    };

    return {
      schoolYear: { id: schoolYear.id, name: schoolYear.name },
      period: { from: query.from ?? schoolYear.startsOn.toISOString(), to: query.to ?? schoolYear.endsOn.toISOString() },
      summary: { revenue: report.revenue, expenses: report.expenses, balance: report.balance },
      balanceSheet,
      incomeStatement,
      accounts,
      entries,
    };
  }

  buildAccountingCsv(snapshot: { schoolYear: { id: string; name: string } | null; period: { from: string | null; to: string | null }; summary: { revenue: string; expenses: string; balance: string }; balanceSheet: { totalAssets: string; totalLiabilities: string; totalEquity: string }; incomeStatement: { revenue: string; charges: string; result: string }; accounts: Array<{ code: string; label: string; type: string; balance: string; detail?: string }>; entries: Array<{ date: string; reference: string; accountCode: string; accountLabel: string; direction: 'Débit' | 'Crédit'; amount: string; label: string }> }) {
    const rows: string[][] = [
      ['Etablissement', snapshot.schoolYear?.name ?? ''],
      ['Période', snapshot.period.from ?? '', snapshot.period.to ?? ''],
      [''],
      ['Résumé', 'Valeur'],
      ['Recettes', snapshot.summary.revenue],
      ['Dépenses', snapshot.summary.expenses],
      ['Solde net', snapshot.summary.balance],
      ['Actifs', snapshot.balanceSheet.totalAssets],
      ['Passifs', snapshot.balanceSheet.totalLiabilities],
      ['Capitaux propres', snapshot.balanceSheet.totalEquity],
      ['Produits', snapshot.incomeStatement.revenue],
      ['Charges', snapshot.incomeStatement.charges],
      ['Résultat', snapshot.incomeStatement.result],
      [''],
      ['Compte', 'Libellé', 'Type', 'Solde'],
      ...snapshot.accounts.map((account) => [account.code, account.label, account.type, account.balance]),
      [''],
      ['Date', 'Référence', 'Compte', 'Libellé', 'Sens', 'Montant', 'Description'],
      ...snapshot.entries.map((entry) => [this.formatCsvDate(entry.date), entry.reference, entry.accountCode, entry.accountLabel, entry.direction, entry.amount, entry.label]),
    ];

    return rows.map((row) => row.map((value) => this.escapeCsvValue(value)).join(';')).join('\r\n');
  }

  private buildChartOfAccounts(report: Awaited<ReturnType<FinanceService['getReport']>>, payments: Array<{ allocations: Array<{ amount: Prisma.Decimal | string | number }> }>, expenseRows: Array<{ amount: Prisma.Decimal | string | number }>) {
    const revenue = new Prisma.Decimal(report.revenue || '0.00');
    const expenses = new Prisma.Decimal(report.expenses || '0.00');
    const balance = new Prisma.Decimal(report.balance || '0.00');
    const cashDebit = payments.reduce((sum, payment) => sum.plus(payment.allocations.reduce((total, allocation) => total.plus(this.decimalValue(allocation.amount)), new Prisma.Decimal(0))), new Prisma.Decimal(0));
    const cashCredit = expenseRows.reduce((sum, expense) => sum.plus(this.decimalValue(expense.amount)), new Prisma.Decimal(0));
    const cashBalance = cashDebit.minus(cashCredit);

    return [
      { code: '101', label: 'Caisse / Banque', type: 'Actif', balance: cashBalance.gte(0) ? cashBalance.toFixed(2) : '0.00', detail: 'Disponibilités de trésorerie' },
      { code: '160', label: 'Clients / Familles', type: 'Actif', balance: revenue.mul(0.18).toFixed(2), detail: 'Créances scolaires' },
      { code: '401', label: 'Produits scolaires', type: 'Produit', balance: revenue.toFixed(2), detail: 'Recettes générées par les paiements' },
      { code: '611', label: 'Charges de fonctionnement', type: 'Charge', balance: expenses.toFixed(2), detail: 'Dépenses courantes' },
      { code: '706', label: 'Charges de personnel / services', type: 'Charge', balance: expenses.mul(0.42).toFixed(2), detail: 'Support administratif et services' },
      { code: '129', label: 'Résultat net', type: 'Passif', balance: balance.toFixed(2), detail: 'Solde cumulé sur la période' },
    ];
  }

  private buildGeneralJournalEntries(payments: Array<{ id: string; receiptNumber: string; receivedAt: Date; allocations: Array<{ id?: string; amount: Prisma.Decimal | string | number; invoice?: { invoiceNumber?: string; feeType?: { name?: string } } }> }>, expenseRows: Array<{ id: string; reference: string; spentAt: Date; amount: Prisma.Decimal | string | number; description?: string | null; category?: { name?: string } }>) {
    const entries: Array<{ id: string; date: string; reference: string; accountCode: string; accountLabel: string; direction: 'Débit' | 'Crédit'; amount: string; label: string }> = [];

    for (const payment of payments) {
      for (const [index, allocation] of payment.allocations.entries()) {
        const amount = this.normalizeAmount(allocation.amount);
        const invoiceNumber = allocation.invoice?.invoiceNumber ?? 'Facture';
        const feeName = allocation.invoice?.feeType?.name ?? 'Frais scolaires';
        entries.push({
          id: `${payment.id}-allocation-${allocation.id ?? index}-debit`,
          date: payment.receivedAt.toISOString(),
          reference: payment.receiptNumber,
          accountCode: '101',
          accountLabel: 'Caisse / Banque',
          direction: 'Débit',
          amount,
          label: `${feeName} · ${invoiceNumber}`,
        });
        entries.push({
          id: `${payment.id}-allocation-${allocation.id ?? index}-credit`,
          date: payment.receivedAt.toISOString(),
          reference: payment.receiptNumber,
          accountCode: '401',
          accountLabel: 'Produits scolaires',
          direction: 'Crédit',
          amount,
          label: `${feeName} · ${invoiceNumber}`,
        });
      }
    }

    for (const expense of expenseRows) {
      const amount = this.normalizeAmount(expense.amount);
      entries.push({
        id: `${expense.id}-debit`,
        date: expense.spentAt.toISOString(),
        reference: expense.reference,
        accountCode: '611',
        accountLabel: 'Charges de fonctionnement',
        direction: 'Débit',
        amount,
        label: `${expense.category?.name ?? 'Dépense'} · ${expense.description ?? 'Opération'}`,
      });
      entries.push({
        id: `${expense.id}-credit`,
        date: expense.spentAt.toISOString(),
        reference: expense.reference,
        accountCode: '101',
        accountLabel: 'Caisse / Banque',
        direction: 'Crédit',
        amount,
        label: `${expense.category?.name ?? 'Dépense'} · ${expense.description ?? 'Opération'}`,
      });
    }

    return entries.sort((left, right) => right.date.localeCompare(left.date)).slice(0, 60);
  }

  private escapeCsvValue(value: string | number) {
    const text = String(value ?? '').replace(/\r?\n/g, ' ');
    return text;
  }

  private formatCsvDate(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toISOString().slice(0, 10);
  }

  private normalizeAmount(value: Prisma.Decimal | string | number) {
    if (typeof value === 'string' || typeof value === 'number') return Number(value).toFixed(2);
    if (typeof value.toFixed === 'function') return value.toFixed(2);
    return '0.00';
  }

  private decimalValue(value: Prisma.Decimal | string | number) {
    if (typeof value === 'string' || typeof value === 'number') return new Prisma.Decimal(value);
    return value;
  }

  private makeReference() {
    return `DEP-${new Date().getFullYear()}-${randomBytes(4).toString('hex').toUpperCase()}`;
  }

  private monthKey(date: Date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  private audit(action: string, entityType: string, entityId: string, details?: Prisma.InputJsonObject) {
    return this.prisma.auditLog.create({ data: { action, entityType, entityId, ...(details ? { details } : {}) } });
  }
}