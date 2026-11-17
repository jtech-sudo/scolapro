import { Injectable } from '@nestjs/common';
import { Prisma, AttendanceStatus, ExpenseStatus, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class StatisticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDailyReport(date: string) {
    const from = new Date(`${date.slice(0, 10)}T00:00:00.000Z`);
    const to = new Date(from.getTime() + 24 * 60 * 60 * 1000);
    const range = { gte: from, lt: to };
    const [students, sessions, payments, expenses, invoices, activities] = await Promise.all([
      this.prisma.student.findMany({
        where: { createdAt: range },
        select: { id: true, firstName: true, lastName: true, matricule: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.attendanceSession.findMany({
        where: { date: { gte: from, lt: to } },
        include: { class: { include: { level: true } }, records: { select: { status: true } } },
        orderBy: [{ class: { name: 'asc' } }, { slot: 'asc' }],
      }),
      this.prisma.payment.findMany({
        where: { status: PaymentStatus.RECORDED, receivedAt: range },
        select: { id: true, receiptNumber: true, amount: true, method: true, receivedAt: true },
        orderBy: { receivedAt: 'desc' },
      }),
      this.prisma.expense.findMany({
        where: { status: ExpenseStatus.RECORDED, spentAt: range },
        include: { category: { select: { name: true } } },
        orderBy: { spentAt: 'desc' },
      }),
      this.prisma.invoice.findMany({
        where: { createdAt: range },
        include: { student: { select: { firstName: true, lastName: true, matricule: true } }, feeType: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.findMany({
        where: { createdAt: range },
        select: { id: true, action: true, entityType: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    ]);

    const attendance = sessions.map((session) => {
      const totals = { present: 0, absent: 0, late: 0, excused: 0 };
      for (const record of session.records) {
        if (record.status === AttendanceStatus.PRESENT) totals.present += 1;
        else if (record.status === AttendanceStatus.ABSENT) totals.absent += 1;
        else if (record.status === AttendanceStatus.LATE) totals.late += 1;
        else if (record.status === AttendanceStatus.EXCUSED) totals.excused += 1;
      }
      return {
        id: session.id,
        className: `${session.class.level.name} · ${session.class.name}`,
        slot: session.slot,
        studentCount: session.records.length,
        ...totals,
      };
    });
    const decimalTotal = (values: Prisma.Decimal[]) => values.reduce((sum, value) => sum.plus(value), new Prisma.Decimal(0)).toFixed(2);

    return {
      date: date.slice(0, 10),
      summary: {
        newStudents: students.length,
        attendanceSessions: sessions.length,
        attendanceRecords: attendance.reduce((total, session) => total + session.studentCount, 0),
        present: attendance.reduce((total, session) => total + session.present, 0),
        absent: attendance.reduce((total, session) => total + session.absent, 0),
        late: attendance.reduce((total, session) => total + session.late, 0),
        excused: attendance.reduce((total, session) => total + session.excused, 0),
        paymentCount: payments.length,
        payments: decimalTotal(payments.map((payment) => payment.amount)),
        expenseCount: expenses.length,
        expenses: decimalTotal(expenses.map((expense) => expense.amount)),
        invoiceCount: invoices.length,
        invoiced: decimalTotal(invoices.map((invoice) => invoice.amountDue)),
        activityCount: activities.length,
      },
      attendance,
      students,
      payments: payments.map((payment) => ({ ...payment, amount: payment.amount.toFixed(2) })),
      expenses: expenses.map((expense) => ({
        id: expense.id,
        reference: expense.reference,
        description: expense.description,
        amount: expense.amount.toFixed(2),
        spentAt: expense.spentAt,
        category: expense.category.name,
      })),
      invoices: invoices.map((invoice) => ({
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        studentName: `${invoice.student.firstName} ${invoice.student.lastName}`,
        matricule: invoice.student.matricule,
        feeType: invoice.feeType.name,
        amountDue: invoice.amountDue.toFixed(2),
        createdAt: invoice.createdAt,
      })),
      activities,
    };
  }
}
