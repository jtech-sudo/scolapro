import { FormEvent, useEffect, useState } from 'react';
import { apiRequest, Expense, ExpenseCategory, FinanceReport, GeneralAccountingSnapshot, Payment, PAYMENT_METHOD_LABELS, SchoolYear } from './api';
import { useAccess } from './AccessContext';

type Tab = 'journal' | 'accounting' | 'expenses' | 'categories' | 'reports';
type LedgerEntry = {
  id: string;
  date: string;
  reference: string;
  type: 'RECETTE' | 'DEPENSE';
  detail: string;
  contact: string;
  method: string;
  amount: string;
  status: string;
  statusClass: 'recorded' | 'cancelled' | 'refunded';
};
const emptyReport: FinanceReport = { schoolYear: null, period: { from: null, to: null }, revenue: '0.00', expenses: '0.00', balance: '0.00', expenseCount: 0, revenueByFee: [], expensesByCategory: [], monthly: [] };

export function FinancePage({ onBack, initialTab = 'journal' }: { onBack: () => void; initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [years, setYears] = useState<SchoolYear[]>([]);
  const [schoolYearId, setSchoolYearId] = useState('');
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [report, setReport] = useState<FinanceReport>(emptyReport);
  const [accounting, setAccounting] = useState<GeneralAccountingSnapshot | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [yearData, categoryData] = await Promise.all([
        apiRequest<SchoolYear[]>('/school-years'),
        apiRequest<ExpenseCategory[]>('/expense-categories'),
      ]);
      const selectedYear = yearData.find((year) => year.id === schoolYearId) ?? yearData.find((year) => year.isCurrent) ?? yearData[0];
      setYears(yearData);
      setCategories(categoryData);
      setSchoolYearId(selectedYear?.id ?? '');
      if (!selectedYear) {
        setExpenses([]);
        setPayments([]);
        setReport(emptyReport);
        return;
      }
      const query = new URLSearchParams({ schoolYearId: selectedYear.id });
      if (from) query.set('from', from);
      if (to) query.set('to', to);
      const [expenseData, reportData, paymentData, accountingData] = await Promise.all([
        apiRequest<Expense[]>(`/expenses?${query.toString()}`),
        apiRequest<FinanceReport>(`/finance/report?${query.toString()}`),
        apiRequest<Payment[]>(`/payments?schoolYearId=${encodeURIComponent(selectedYear.id)}`),
        apiRequest<GeneralAccountingSnapshot>(`/finance/accounting?${query.toString()}`),
      ]);
      setExpenses(expenseData);
      setReport(reportData);
      setPayments(paymentData);
      setAccounting(accountingData);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Impossible de charger les données financières.');
    } finally { setLoading(false); }
  }

  useEffect(() => { void loadData(); }, [schoolYearId, from, to]);

  async function submit(event: FormEvent<HTMLFormElement>, task: () => Promise<unknown>, message: string, reset?: () => void) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await task();
      reset?.();
      setSuccess(message);
      await loadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Impossible d’enregistrer cette opération.');
    } finally { setSaving(false); }
  }

  async function cancelExpense(expense: Expense) {
    const reason = window.prompt(`Motif d’annulation de ${expense.reference} :`);
    if (!reason?.trim()) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await apiRequest(`/expenses/${expense.id}/cancel`, { method: 'POST', body: { reason } });
      setSuccess(`Dépense ${expense.reference} annulée et tracée.`);
      await loadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Impossible d’annuler la dépense.');
    } finally { setSaving(false); }
  }

  const tabs: Array<[Tab, string]> = [['journal', 'Journal comptable'], ['accounting', 'Comptabilité générale'], ['expenses', 'Dépenses'], ['categories', 'Catégories'], ['reports', 'Rapports']];
  const currency = 'XOF';
  const ledgerEntries: LedgerEntry[] = [
    ...payments.flatMap((payment) => payment.allocations
      .filter((allocation) => allocation.invoice.schoolYear.id === schoolYearId)
      .map((allocation) => ({
        id: `${payment.id}-${allocation.id}`,
        date: payment.receivedAt,
        reference: payment.receiptNumber,
        type: 'RECETTE' as const,
        detail: `${allocation.invoice.feeType.name} · ${allocation.invoice.invoiceNumber}`,
        contact: `${allocation.invoice.student.firstName} ${allocation.invoice.student.lastName} · ${allocation.invoice.student.matricule}`,
        method: PAYMENT_METHOD_LABELS[payment.method] ?? payment.method,
        amount: allocation.amount,
        status: payment.status === 'RECORDED' ? 'Enregistrée' : payment.status === 'CANCELLED' ? 'Annulée' : 'Remboursée',
        statusClass: payment.status === 'RECORDED' ? 'recorded' as const : payment.status === 'CANCELLED' ? 'cancelled' as const : 'refunded' as const,
      }))),
    ...expenses.map((expense) => ({
      id: expense.id,
      date: expense.spentAt,
      reference: expense.reference,
      type: 'DEPENSE' as const,
      detail: `${expense.category.name} · ${expense.description}`,
      contact: expense.payee ?? 'Non renseigné',
      method: expense.paymentMethod,
      amount: expense.amount,
      status: expense.status === 'RECORDED' ? 'Enregistrée' : 'Annulée',
      statusClass: expense.status === 'RECORDED' ? 'recorded' as const : 'cancelled' as const,
    })),
  ].filter((entry) => {
    const date = entry.date.slice(0, 10);
    return (!from || date >= from) && (!to || date <= to);
  }).sort((left, right) => right.date.localeCompare(left.date));

  function exportLedger() {
    const rows = [
      ['Date', 'Type', 'Référence', 'Détail', 'Élève / bénéficiaire', 'Mode', 'Statut', 'Montant (XOF)'],
      ...ledgerEntries.map((entry) => [dateLabel(entry.date), entry.type, entry.reference, entry.detail, entry.contact, entry.method, entry.status, entry.amount]),
    ];
    downloadCsvFile(`journal-financier-${schoolYearId || 'ecole'}.csv`, rows);
  }

  function exportAccountingCsv() {
    const snapshot = accounting ?? {
      schoolYear: { id: schoolYearId, name: years.find((year) => year.id === schoolYearId)?.name ?? 'Année scolaire' },
      period: { from: from || null, to: to || null },
      summary: { revenue: report.revenue, expenses: report.expenses, balance: report.balance },
      balanceSheet: { totalAssets: report.balance, totalLiabilities: '0.00', totalEquity: report.balance },
      incomeStatement: { revenue: report.revenue, charges: report.expenses, result: report.balance },
      accounts: [],
      entries: [],
    };
    const rows = [
      ['Etablissement', snapshot.schoolYear?.name ?? ''],
      ['Période', snapshot.period.from ?? '', snapshot.period.to ?? ''],
      [],
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
      [],
      ['Compte', 'Libellé', 'Type', 'Solde'],
      ...snapshot.accounts.map((account) => [account.code, account.label, account.type, account.balance]),
      [],
      ['Date', 'Référence', 'Compte', 'Libellé', 'Sens', 'Montant', 'Description'],
      ...snapshot.entries.map((entry) => [entry.date.slice(0, 10), entry.reference, entry.accountCode, entry.accountLabel, entry.direction, entry.amount, entry.label]),
    ];
    const exportBaseName = snapshot.schoolYear?.name
      ? snapshot.schoolYear.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
      : (schoolYearId || 'ecole');
    downloadCsvFile(`comptabilite-${exportBaseName}.csv`, rows);
  }

  return (
    <section className="workspace-page">
      <button className="back-link" onClick={onBack}>← Retour à la vue générale</button>
      <div className="workspace-title-row"><div><p className="eyebrow">PILOTAGE FINANCIER</p><h1>Trésorerie et comptabilité</h1><p>Suivez les recettes, les dépenses, le solde de trésorerie et le journal financier de l’établissement.</p></div><label className="field-label billing-year">Année scolaire<select value={schoolYearId} onChange={(event) => setSchoolYearId(event.target.value)}><option value="">Choisir une année</option>{years.map((year) => <option key={year.id} value={year.id}>{year.name}{year.isCurrent ? ' · En cours' : ''}</option>)}</select></label></div>
      <div className="admin-warning" role="note"><strong>Suivi financier de gestion</strong><span>Le journal regroupe les paiements scolaires et les dépenses enregistrées. Ces états sont indicatifs et servent de base de trésorerie avant l’ouverture de la comptabilité générale, qui viendra compléter la gestion financiere.</span></div>
      {error && <div className="feedback-message error-message" role="alert">{error}</div>}
      {success && <div className="feedback-message success-message" role="status">{success}</div>}
      <div className="billing-summary-grid"><Summary label="Recettes encaissées" value={money(report.revenue, currency)} detail="Paiements scolaires validés" /><Summary label="Dépenses enregistrées" value={money(report.expenses, currency)} detail={`${report.expenseCount} écriture(s) actives`} /><Summary label="Solde net" value={money(report.balance, currency)} detail="Recettes moins dépenses" /></div>
      <nav className="organization-tabs" aria-label="Sections finance et comptabilité">{tabs.map(([id, label]) => <button key={id} className={tab === id ? 'organization-tab active' : 'organization-tab'} onClick={() => setTab(id)}>{label}</button>)}</nav>
      {loading && <p className="inline-hint">Chargement des données financières…</p>}
      {!schoolYearId && tab !== 'categories' && !loading ? <Empty text="Créez une année scolaire avant d’enregistrer et de rapporter les écritures financières." /> : <>
        {tab === 'journal' && <LedgerTab entries={ledgerEntries} from={from} to={to} setFrom={setFrom} setTo={setTo} onExport={exportLedger} currency={currency} />}
        {tab === 'accounting' && <GeneralAccountingTab snapshot={accounting ?? {
          schoolYear: null,
          period: { from: null, to: null },
          summary: { revenue: report.revenue, expenses: report.expenses, balance: report.balance },
          balanceSheet: { totalAssets: report.balance, totalLiabilities: '0.00', totalEquity: report.balance },
          incomeStatement: { revenue: report.revenue, charges: report.expenses, result: report.balance },
          accounts: [],
          entries: [],
        }} currency={currency} />}
        {tab === 'expenses' && <ExpensesTab categories={categories} expenses={expenses} schoolYearId={schoolYearId} currency={currency} saving={saving} submit={submit} cancelExpense={cancelExpense} />}
        {tab === 'categories' && <CategoriesTab categories={categories} saving={saving} submit={submit} />}
        {tab === 'reports' && <ReportsTab report={report} currency={currency} from={from} to={to} setFrom={setFrom} setTo={setTo} />}
      </>}
    </section>
  );
}

type SubmitHandler = (event: FormEvent<HTMLFormElement>, task: () => Promise<unknown>, message: string, reset?: () => void) => Promise<void>;

function LedgerTab({ entries, from, to, setFrom, setTo, onExport, currency }: {
  entries: LedgerEntry[];
  from: string;
  to: string;
  setFrom: (value: string) => void;
  setTo: (value: string) => void;
  onExport: () => void;
  currency: string;
}) {
  return <section className="form-card finance-ledger">
    <div className="finance-ledger-heading">
      <div><p className="eyebrow">JOURNAL DE TRÉSORERIE</p><h2>Recettes et dépenses</h2><span className="section-note">{entries.length} ligne(s) · Les paiements répartis sont détaillés par facture.</span></div>
      <button type="button" className="secondary-button" onClick={onExport} disabled={!entries.length}>Exporter en CSV</button>
    </div>
    <div className="finance-ledger-filters">
      <label className="field-label">Du<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
      <label className="field-label">Au<input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
    </div>
    {entries.length ? <div className="finance-ledger-table-wrap"><table className="finance-ledger-table">
      <thead><tr><th>Date</th><th>Type</th><th>Référence</th><th>Détail</th><th>Élève / bénéficiaire</th><th>Mode</th><th>Statut</th><th className="ledger-amount-cell">Montant ({currency})</th></tr></thead>
      <tbody>{entries.map((entry) => <tr key={entry.id}>
        <td>{dateLabel(entry.date)}</td>
        <td><span className={`ledger-type ${entry.type.toLowerCase()}`}>{entry.type === 'RECETTE' ? 'Recette' : 'Dépense'}</span></td>
        <td><strong>{entry.reference}</strong></td>
        <td>{entry.detail}</td>
        <td>{entry.contact}</td>
        <td>{entry.method}</td>
        <td><span className={`payment-status ${entry.statusClass}`}>{entry.status}</span></td>
        <td className={`ledger-amount-cell ${entry.type.toLowerCase()}`}>{money(entry.amount, currency)}</td>
      </tr>)}</tbody>
    </table></div> : <Empty text="Aucune recette ni dépense enregistrée pour cette période." />}
  </section>;
}

function GeneralAccountingTab({ snapshot, currency }: { snapshot: GeneralAccountingSnapshot; currency: string }) {
  const accountingEntries = snapshot.entries.length ? snapshot.entries : [];
  const balanceGroups = [
    { title: 'Actif', accounts: snapshot.accounts.filter((account) => account.type === 'Actif') },
    { title: 'Passif', accounts: snapshot.accounts.filter((account) => account.type === 'Passif') },
    { title: 'Produit', accounts: snapshot.accounts.filter((account) => account.type === 'Produit') },
    { title: 'Charge', accounts: snapshot.accounts.filter((account) => account.type === 'Charge') },
  ];

  return <section className="form-card finance-ledger">
    <div className="finance-ledger-heading">
      <div><p className="eyebrow">PLAN COMPTABLE</p><h2>Comptabilité générale</h2><span className="section-note">Vue de synthèse pour le compte de résultat et le bilan de gestion.</span></div>
      <button type="button" className="secondary-button" onClick={() => { const rows = [
        ['Etablissement', snapshot.schoolYear?.name ?? ''],
        ['Période', snapshot.period.from ?? '', snapshot.period.to ?? ''],
        [],
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
        [],
        ['Compte', 'Libellé', 'Type', 'Solde'],
        ...snapshot.accounts.map((account) => [account.code, account.label, account.type, account.balance]),
        [],
        ['Date', 'Référence', 'Compte', 'Libellé', 'Sens', 'Montant', 'Description'],
        ...snapshot.entries.map((entry) => [entry.date.slice(0, 10), entry.reference, entry.accountCode, entry.accountLabel, entry.direction, entry.amount, entry.label]),
      ];
      const exportBaseName = snapshot.schoolYear?.name
        ? snapshot.schoolYear.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
        : 'ecole';
      downloadCsvFile(`comptabilite-${exportBaseName}.csv`, rows); }} disabled={!snapshot.accounts.length && !snapshot.entries.length}>Exporter CSV</button>
    </div>
    <div className="billing-summary-grid">
      <Summary label="Recettes scolaires" value={money(snapshot.summary.revenue, currency)} detail="Compte 401" />
      <Summary label="Charges de gestion" value={money(snapshot.summary.expenses, currency)} detail="Compte 611 / 706" />
      <Summary label="Résultat net" value={money(snapshot.summary.balance, currency)} detail="Solde comptable" />
    </div>
    <div className="billing-summary-grid">
      <Summary label="Total actifs" value={money(snapshot.balanceSheet.totalAssets, currency)} detail="Caisse + créances" />
      <Summary label="Total passifs" value={money(snapshot.balanceSheet.totalLiabilities, currency)} detail="Dettes / résultat" />
      <Summary label="Capitaux propres" value={money(snapshot.balanceSheet.totalEquity, currency)} detail="Résultat net consolidé" />
    </div>
    <div className="billing-summary-grid">
      <Summary label="Produits" value={money(snapshot.incomeStatement.revenue, currency)} detail="Produits scolaires" />
      <Summary label="Charges" value={money(snapshot.incomeStatement.charges, currency)} detail="Charges opérationnelles" />
      <Summary label="Résultat" value={money(snapshot.incomeStatement.result, currency)} detail="Compte de résultat" />
    </div>
    <div className="organization-grid two-column report-breakdown">
      <div className="form-card"><FormHeading index="01" title="Compte de résultat" detail="Synthèse des comptes de produits et charges." />{snapshot.accounts.filter((account) => account.type === 'Produit' || account.type === 'Charge').map((account) => <Breakdown key={account.code} name={`${account.code} · ${account.label}`} value={account.balance} total={String(Math.max(Number(snapshot.summary.revenue) + Number(snapshot.summary.expenses || 1), 1))} currency={currency} />)}</div>
      <div className="form-card"><FormHeading index="02" title="Bilan de gestion" detail="Synthèse des soldes de trésorerie et de créances." />{snapshot.accounts.filter((account) => account.type === 'Actif' || account.type === 'Passif').map((account) => <Breakdown key={account.code} name={`${account.code} · ${account.label}`} value={account.balance} total={String(Math.max(Number(snapshot.summary.revenue), Number(snapshot.summary.expenses), Number(snapshot.summary.balance), 1))} currency={currency} />)}</div>
    </div>
    <div className="form-card">
      <FormHeading index="03" title="Balance générale" detail="Soldes détaillés par compte et par catégorie comptable." />
      <div className="records-list">
        {balanceGroups.map((group) => <div key={group.title} className="account-group-block">
          <h3>{group.title}</h3>
          {group.accounts.length ? group.accounts.map((account) => <div key={account.code} className="record-row"><div><strong>{account.code} · {account.label}</strong><small>{account.detail}</small></div><strong>{money(account.balance, currency)}</strong></div>) : <Empty text={`Aucun compte ${group.title.toLowerCase()} pour cette période.`} />}
        </div>)}
      </div>
    </div>
    <div className="form-card">
      <FormHeading index="04" title="Journal général" detail="Pièces comptables groupées par mouvement de caisse et de charges." />
      {accountingEntries.length ? <div className="records-list">
        {accountingEntries.map((entry) => <div className="record-row" key={entry.id}><div><strong>{entry.accountCode} · {entry.accountLabel}</strong><small>{entry.reference} · {entry.label}</small></div><div className="ledger-entry-amts"><span className={entry.direction === 'Débit' ? 'debit-amount' : 'credit-amount'}>{entry.direction}</span><strong>{money(entry.amount, currency)}</strong></div></div>)}
      </div> : <Empty text="Aucune écriture comptable sur cette période." />}
    </div>
  </section>;
}

function ExpensesTab({ categories, expenses, schoolYearId, currency, saving, submit, cancelExpense }: {
  categories: ExpenseCategory[]; expenses: Expense[]; schoolYearId: string; currency: string; saving: boolean;
  submit: SubmitHandler; cancelExpense: (expense: Expense) => Promise<void>;
}) {
  const { can } = useAccess();
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [spentAt, setSpentAt] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState('Espèces');
  const [payee, setPayee] = useState('');
  return <>
    {can('finance', 'canCreate') && <form className="form-card expense-form" onSubmit={(event) => void submit(event, () => apiRequest<Expense>('/expenses', { method: 'POST', body: { categoryId, schoolYearId, description, amount, spentAt, paymentMethod, ...(payee ? { payee } : {}) } }), 'Dépense enregistrée et auditée.', () => { setDescription(''); setAmount(''); setPayee(''); })}>
      <FormHeading index="01" title="Enregistrer une dépense" detail="Les écritures ne sont pas supprimées ; toute annulation est motivée et tracée." />
      <div className="expense-fields"><label className="field-label">Catégorie<select required value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">Choisir une catégorie</option>{categories.filter((category) => category.isActive).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label className="field-label">Description<input required maxLength={240} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Ex. achat de fournitures" /></label><label className="field-label">Montant ({currency})<input required type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} /></label><label className="field-label">Date<input required type="date" value={spentAt} onChange={(event) => setSpentAt(event.target.value)} /></label><label className="field-label">Mode de règlement<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}><option>Espèces</option><option>Virement bancaire</option><option>Chèque</option><option>Mobile money</option><option>Autre</option></select></label><label className="field-label">Bénéficiaire<input maxLength={120} value={payee} onChange={(event) => setPayee(event.target.value)} placeholder="Fournisseur ou personne" /></label></div>
      <button className="primary-button expense-submit" disabled={saving || !schoolYearId || !categories.some((category) => category.isActive)}>{saving ? 'Enregistrement…' : 'Enregistrer la dépense'}</button>
      {!categories.some((category) => category.isActive) && <p className="inline-hint">Créez ou réactivez une catégorie de dépenses avant l’enregistrement.</p>}
    </form>}
    <div className="configured-list"><div className="section-heading"><div><p className="eyebrow">JOURNAL DES DÉPENSES</p><h2>{expenses.length} écriture(s)</h2></div></div>{expenses.length ? <div className="records-list">{expenses.map((expense) => <div className="record-row expense-record" key={expense.id}><span className={`payment-status ${expense.status.toLowerCase()}`}>{expense.status === 'RECORDED' ? 'Enregistrée' : 'Annulée'}</span><div><strong>{expense.description}</strong><small>{expense.reference} · {expense.category.name}{expense.payee ? ` · ${expense.payee}` : ''} · {expense.paymentMethod} · {dateLabel(expense.spentAt)}</small>{expense.cancellationReason && <small className="cancel-reason">Motif : {expense.cancellationReason}</small>}</div><strong className="expense-amount">{money(expense.amount, currency)}</strong>{expense.status === 'RECORDED' && can('finance', 'canUpdate') && <button className="table-action danger-action" disabled={saving} onClick={() => void cancelExpense(expense)}>Annuler</button>}</div>)}</div> : <Empty text="Aucune dépense enregistrée dans cette période." />}</div>
  </>;
}

function CategoriesTab({ categories, saving, submit }: { categories: ExpenseCategory[]; saving: boolean; submit: SubmitHandler }) {
  const { can } = useAccess();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [busyId, setBusyId] = useState('');
  return <div className="organization-grid two-column">{can('finance', 'canCreate') && <form className="form-card" onSubmit={(event) => void submit(event, () => apiRequest('/expense-categories', { method: 'POST', body: { name, ...(description ? { description } : {}) } }), 'Catégorie de dépenses créée.', () => { setName(''); setDescription(''); })}>
    <FormHeading index="01" title="Créer une catégorie" detail="Ex. salaires, fournitures, entretien, transport." />
    <label className="field-label">Nom<input required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} /></label><label className="field-label">Description<input maxLength={240} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
    <button className="primary-button" disabled={saving}>{saving ? 'Enregistrement…' : 'Ajouter la catégorie'}</button>
  </form>}<div className="records-list">{categories.map((category) => <div className="record-row" key={category.id}><span className={`student-status ${category.isActive ? 'active' : 'archived'}`}>{category.isActive ? 'Active' : 'Archivée'}</span><div><strong>{category.name}</strong><small>{category.description ?? 'Sans description'} · {category._count?.expenses ?? 0} dépense(s)</small></div>{can('finance', 'canUpdate') && <button className="table-action" disabled={busyId === category.id} onClick={async () => { setBusyId(category.id); await submit(new Event('submit') as unknown as FormEvent<HTMLFormElement>, () => apiRequest(`/expense-categories/${category.id}`, { method: 'PATCH', body: { isActive: !category.isActive } }), `Catégorie ${category.isActive ? 'archivée' : 'réactivée'}.`); setBusyId(''); }}>{category.isActive ? 'Archiver' : 'Réactiver'}</button>}</div>)}{!categories.length && <Empty text="Aucune catégorie de dépenses configurée." />}</div></div>;
}

function ReportsTab({ report, currency, from, to, setFrom, setTo }: { report: FinanceReport; currency: string; from: string; to: string; setFrom: (value: string) => void; setTo: (value: string) => void }) {
  const maximum = Math.max(1, ...report.monthly.flatMap((month) => [Number(month.revenue), Number(month.expenses)]));
  return <>
    <div className="form-card report-period"><div><p className="eyebrow">SYNTHÈSE PAR PÉRIODE</p><h2>{report.schoolYear?.name ?? 'Année scolaire'}</h2></div><div className="form-row"><label className="field-label">Du<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label><label className="field-label">Au<input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label></div></div>
    <div className="organization-grid two-column report-breakdown"><div className="form-card"><FormHeading index="01" title="Recettes par frais" detail="Montants affectés aux paiements encaissés." />{report.revenueByFee.length ? report.revenueByFee.map((item) => <Breakdown key={item.name} name={item.name} value={item.amount} total={report.revenue} currency={currency} />) : <Empty text="Aucune recette encaissée sur cette période." />}</div><div className="form-card"><FormHeading index="02" title="Dépenses par catégorie" detail="Les dépenses annulées sont exclues du rapport." />{report.expensesByCategory.length ? report.expensesByCategory.map((item) => <Breakdown key={item.name} name={item.name} value={item.amount} total={report.expenses} currency={currency} />) : <Empty text="Aucune dépense enregistrée sur cette période." />}</div></div>
    <div className="form-card monthly-report"><FormHeading index="03" title="Évolution mensuelle" detail="Comparaison des recettes encaissées et des dépenses enregistrées." />{report.monthly.length ? <div className="monthly-bars">{report.monthly.map((month) => <div className="month-column" key={month.month}><div className="bar-group"><div className="finance-bar revenue" style={{ height: `${Math.max(3, Number(month.revenue) / maximum * 100)}%` }} title={`Recettes ${money(month.revenue, currency)}`} /><div className="finance-bar expenses" style={{ height: `${Math.max(3, Number(month.expenses) / maximum * 100)}%` }} title={`Dépenses ${money(month.expenses, currency)}`} /></div><strong>{monthLabel(month.month)}</strong><small>Net {money(month.balance, currency)}</small></div>)}</div> : <Empty text="Aucune écriture à représenter." />}<div className="chart-legend"><span><i className="revenue-dot" /> Recettes</span><span><i className="expense-dot" /> Dépenses</span></div></div>
  </>;
}

function downloadCsvFile(filename: string, rows: Array<Array<string | number>>) {
  const csv = `\uFEFF${rows.map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(';')).join('\r\n')}`;
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Breakdown({ name, value, total, currency }: { name: string; value: string; total: string; currency: string }) {
  const percentage = Number(total) > 0 ? Math.min(100, Number(value) / Number(total) * 100) : 0;
  return <div className="breakdown-row"><div><strong>{name}</strong><span>{money(value, currency)}</span></div><div className="breakdown-track"><i style={{ width: `${percentage}%` }} /></div></div>;
}

function Summary({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <article className="billing-summary-card"><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>;
}

function FormHeading({ index, title, detail }: { index: string; title: string; detail: string }) {
  return <div className="form-card-heading"><span className="module-number">{index}</span><div><strong>{title}</strong><small>{detail}</small></div></div>;
}

function Empty({ text }: { text: string }) { return <div className="list-empty"><strong>Rien à afficher</strong><span>{text}</span></div>; }
function money(value: string, currency: string) { return new Intl.NumberFormat('fr-FR', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value)); }
function dateLabel(value: string) { return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(value)); }
function monthLabel(value: string) { return new Intl.DateTimeFormat('fr-FR', { month: 'short', year: '2-digit' }).format(new Date(`${value}-01T12:00:00`)); }