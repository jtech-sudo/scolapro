const assert = require('node:assert/strict');
const { test } = require('node:test');
const { Prisma } = require('@prisma/client');
const { FinanceService } = require('../dist/finance/finance.service.js');

test('creates a real double-entry accounting journal from payments and expenses', async () => {
  const service = new FinanceService({
    schoolYear: { findUnique: async () => ({ id: 'school-year-1', name: '2026-2027', startsOn: new Date('2026-09-01'), endsOn: new Date('2027-06-30') }) },
    payment: { findMany: async () => [
      {
        id: 'pay-1',
        receiptNumber: 'RCPT-001',
        receivedAt: new Date('2026-10-10'),
        allocations: [
          {
            id: 'alloc-1',
            amount: new Prisma.Decimal('1000.00'),
            invoice: {
              invoiceNumber: 'INV-001',
              schoolYearId: 'school-year-1',
              feeType: { name: 'Frais de scolarité' },
            },
          },
        ],
      },
    ] },
    expense: { findMany: async () => [
      {
        id: 'exp-1',
        reference: 'DEP-001',
        spentAt: new Date('2026-10-12'),
        amount: new Prisma.Decimal('400.00'),
        description: 'Fournitures scolaires',
        category: { name: 'Fournitures' },
      },
    ] },
  });

  service.getReport = async () => ({
    schoolYear: { id: 'school-year-1', name: '2026-2027' },
    period: { from: '2026-09-01', to: '2027-06-30' },
    revenue: '1000.00',
    expenses: '400.00',
    balance: '600.00',
    expenseCount: 1,
    revenueByFee: [],
    expensesByCategory: [],
    monthly: [],
  });

  const snapshot = await service.getAccountingSnapshot({ schoolYearId: 'school-year-1' });

  assert.deepEqual(snapshot.summary, { revenue: '1000.00', expenses: '400.00', balance: '600.00' });
  assert.deepEqual(snapshot.balanceSheet, { totalAssets: '1180.00', totalLiabilities: '0.00', totalEquity: '600.00' });
  assert.deepEqual(snapshot.incomeStatement, { revenue: '1000.00', charges: '400.00', result: '600.00' });
  assert.ok(snapshot.entries.some((entry) => entry.accountCode === '101' && entry.direction === 'Débit' && entry.amount === '1000.00'));
  assert.ok(snapshot.entries.some((entry) => entry.accountCode === '401' && entry.direction === 'Crédit' && entry.amount === '1000.00'));
  assert.ok(snapshot.entries.some((entry) => entry.accountCode === '611' && entry.direction === 'Débit' && entry.amount === '400.00'));
  assert.ok(snapshot.entries.some((entry) => entry.accountCode === '101' && entry.direction === 'Crédit' && entry.amount === '400.00'));
});

test('exports the accounting snapshot into a CSV ledger', () => {
  const service = new FinanceService({});

  const snapshot = {
    schoolYear: { id: 'school-year-1', name: '2026-2027' },
    period: { from: '2026-09-01', to: '2027-06-30' },
    summary: { revenue: '1000.00', expenses: '400.00', balance: '600.00' },
    balanceSheet: { totalAssets: '1180.00', totalLiabilities: '0.00', totalEquity: '600.00' },
    incomeStatement: { revenue: '1000.00', charges: '400.00', result: '600.00' },
    accounts: [
      { code: '101', label: 'Caisse / Banque', type: 'Actif', balance: '1000.00', detail: 'Disponibilités' },
      { code: '401', label: 'Produits scolaires', type: 'Produit', balance: '1000.00', detail: 'Recettes' },
      { code: '611', label: 'Charges de fonctionnement', type: 'Charge', balance: '400.00', detail: 'Dépenses' },
    ],
    entries: [
      { id: 'entry-1', date: '2026-10-10T00:00:00.000Z', reference: 'RCPT-001', accountCode: '101', accountLabel: 'Caisse / Banque', direction: 'Débit', amount: '1000.00', label: 'Frais de scolarité · INV-001' },
      { id: 'entry-2', date: '2026-10-12T00:00:00.000Z', reference: 'DEP-001', accountCode: '611', accountLabel: 'Charges de fonctionnement', direction: 'Débit', amount: '400.00', label: 'Fournitures · Facture' },
    ],
  };

  const csv = service.buildAccountingCsv(snapshot);

  assert.ok(csv.includes('Etablissement;2026-2027'));
  assert.ok(csv.includes('Compte;Libellé;Type;Solde'));
  assert.ok(csv.includes('101;Caisse / Banque;Actif;1000.00'));
  assert.ok(csv.includes('Date;Référence;Compte;Libellé;Sens;Montant;Description'));
  assert.ok(csv.includes('2026-10-10;RCPT-001;101;Caisse / Banque;Débit;1000.00;Frais de scolarité · INV-001'));
});
