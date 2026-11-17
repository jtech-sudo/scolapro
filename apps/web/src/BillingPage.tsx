import { FormEvent, useEffect, useMemo, useState } from 'react';
import { apiRequest, BillingSummary, FeeType, Invoice, Payment, PAYMENT_METHOD_LABELS, PlatformPlanSetting, Receipt, SchoolProfile, SchoolSubscription, SchoolYear, Student, SubscriptionPlanKey } from './api';
import { useAccess } from './AccessContext';

type Tab = 'invoices' | 'payments' | 'fees' | 'balances' | 'subscription';
type AllocationDraft = { invoiceId: string; amount: string };
const emptySummary: BillingSummary = { invoiceCount: 0, totalInvoiced: '0.00', totalPaid: '0.00', totalBalance: '0.00', unpaidInvoiceCount: 0, currency: 'XOF' };

export function BillingPage({ onBack, isSchoolAdmin, openSubscriptionCount }: { onBack: () => void; isSchoolAdmin: boolean; openSubscriptionCount: number }) {
  const [tab, setTab] = useState<Tab>(openSubscriptionCount > 0 ? 'subscription' : 'invoices');
  const [schoolYears, setSchoolYears] = useState<SchoolYear[]>([]);
  const [schoolYearId, setSchoolYearId] = useState('');
  const [profile, setProfile] = useState<SchoolProfile | null>(null);
  const [feeTypes, setFeeTypes] = useState<FeeType[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [summary, setSummary] = useState(emptySummary);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  useEffect(() => {
    if (openSubscriptionCount > 0) setTab('subscription');
  }, [openSubscriptionCount]);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [years, feeData, studentData, profileData] = await Promise.all([
        apiRequest<SchoolYear[]>('/school-years'),
        apiRequest<FeeType[]>('/fee-types'),
        apiRequest<{ data: Student[] }>('/students?page=1&pageSize=100'),
        apiRequest<SchoolProfile>('/admin/school-profile'),
      ]);
      const selectedYear = years.find((year) => year.id === schoolYearId) ?? years.find((year) => year.isCurrent) ?? years[0];
      setSchoolYears(years);
      setSchoolYearId(selectedYear?.id ?? '');
      setFeeTypes(feeData);
      setStudents(studentData.data);
      setProfile(profileData);
      if (!selectedYear) {
        setInvoices([]);
        setPayments([]);
        setSummary(emptySummary);
        return;
      }
      const yearQuery = `?schoolYearId=${encodeURIComponent(selectedYear.id)}`;
      const [invoiceData, paymentData, summaryData] = await Promise.all([
        apiRequest<Invoice[]>(`/invoices${yearQuery}`),
        apiRequest<Payment[]>(`/payments${yearQuery}`),
        apiRequest<BillingSummary>(`/billing/summary${yearQuery}`),
      ]);
      setInvoices(invoiceData);
      setPayments(paymentData);
      setSummary(summaryData);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Impossible de charger les données financières.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadData(); }, [schoolYearId]);

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

  async function cancelPayment(payment: Payment) {
    const reason = window.prompt(`Motif d’annulation du reçu ${payment.receiptNumber} :`);
    if (!reason?.trim()) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await apiRequest(`/payments/${payment.id}/cancel`, { method: 'POST', body: { reason } });
      setSuccess(`Paiement ${payment.receiptNumber} annulé et tracé.`);
      await loadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Impossible d’annuler le paiement.');
    } finally { setSaving(false); }
  }

  async function openReceipt(payment: Payment) {
    setError('');
    try { setReceipt(await apiRequest<Receipt>(`/payments/${payment.id}/receipt`)); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Reçu indisponible.'); }
  }

  async function toggleFeeType(fee: FeeType) {
    setError('');
    setSuccess('');
    try {
      await apiRequest(`/fee-types/${fee.id}`, { method: 'PATCH', body: { isActive: !fee.isActive } });
      setSuccess(`Type de frais ${fee.isActive ? 'archivé' : 'réactivé'}.`);
      await loadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Impossible de modifier le type de frais.');
    }
  }

  const filteredInvoices = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('fr');
    return invoices.filter((invoice) => !query || `${invoice.invoiceNumber} ${invoice.student.firstName} ${invoice.student.lastName} ${invoice.student.matricule} ${invoice.feeType.name}`.toLocaleLowerCase('fr').includes(query));
  }, [invoices, search]);
  const currency = profile?.currency ?? 'XOF';
  const tabs: Array<[Tab, string]> = [['invoices', 'Factures'], ['payments', 'Paiements et reçus'], ['fees', 'Types de frais'], ['balances', 'Soldes'], ['subscription', 'Abonnement plateforme']];

  return (
    <section className="workspace-page">
      <button className="back-link" onClick={onBack}>← Retour à la vue générale</button>
      <div className="workspace-title-row"><div><p className="eyebrow">GESTION FINANCIÈRE SCOLAIRE</p><h1>Facturation et paiements</h1><p>Émettez les frais, enregistrez des paiements partiels et suivez les soldes.</p></div><label className="field-label billing-year">Année scolaire<select value={schoolYearId} onChange={(event) => setSchoolYearId(event.target.value)}><option value="">Choisir une année</option>{schoolYears.map((year) => <option key={year.id} value={year.id}>{year.name}{year.isCurrent ? ' · En cours' : ''}</option>)}</select></label></div>
      <div className="admin-warning" role="note"><strong>Saisie manuelle uniquement</strong><span>Airtel Money, Moov Money, Zamani Cash, Western Union et MoneyGram sont des modes de paiement à enregistrer après encaissement : aucun transfert n’est déclenché ou vérifié par l’application. Enregistrez uniquement les paiements réellement reçus et autorisés.</span></div>
      {error && <div className="feedback-message error-message" role="alert">{error}</div>}
      {success && <div className="feedback-message success-message" role="status">{success}</div>}
      <div className="billing-summary-grid"><SummaryCard label="Facturé" value={formatMoney(summary.totalInvoiced, currency)} detail={`${summary.invoiceCount} facture(s)`} /><SummaryCard label="Encaissé" value={formatMoney(summary.totalPaid, currency)} detail="Paiements non annulés" /><SummaryCard label="Solde restant" value={formatMoney(summary.totalBalance, currency)} detail={`${summary.unpaidInvoiceCount} facture(s) non soldée(s)`} /></div>
      <nav className="organization-tabs" aria-label="Sections de facturation">{tabs.map(([id, label]) => <button key={id} className={tab === id ? 'organization-tab active' : 'organization-tab'} onClick={() => setTab(id)}>{label}</button>)}</nav>
      {loading && <p className="inline-hint">Chargement des écritures…</p>}
      {tab === 'subscription' && <SubscriptionPlanTab isSchoolAdmin={isSchoolAdmin} />}
      {!schoolYearId && tab !== 'fees' && tab !== 'subscription' && !loading ? <Empty text="Créez une année scolaire et inscrivez les élèves avant d’émettre des factures." /> : <>
        {tab === 'invoices' && <InvoicesTab students={students} feeTypes={feeTypes} invoices={filteredInvoices} currency={currency} saving={saving} submit={submit} search={search} setSearch={setSearch} schoolYearId={schoolYearId} />}
        {tab === 'payments' && <PaymentsTab invoices={invoices} payments={payments} schoolYears={schoolYears} currency={currency} saving={saving} submit={submit} openReceipt={openReceipt} cancelPayment={cancelPayment} />}
        {tab === 'fees' && <FeeTypesTab feeTypes={feeTypes} saving={saving} submit={submit} toggleFeeType={toggleFeeType} />}
        {tab === 'balances' && <BalancesTab invoices={filteredInvoices} currency={currency} search={search} setSearch={setSearch} />}
      </>}
      {receipt && <ReceiptDialog receipt={receipt} currency={currency} profile={profile} onClose={() => setReceipt(null)} />}
    </section>
  );
}

const subscriptionPlanDetails: Record<SubscriptionPlanKey, { label: string; students: string; features: string }> = {
  STARTER: { label: 'Starter', students: 'Jusqu’à 150 élèves', features: 'Inscriptions, classes, notes, bulletins et frais scolaires.' },
  PRO: { label: 'Pro', students: 'Jusqu’à 500 élèves', features: 'Starter, avec comptabilité, rapports, enseignants et présences.' },
  PREMIUM: { label: 'Premium', students: 'Jusqu’à 1 000 élèves', features: 'Gestion complète, rapports avancés et portail parents.' },
  ENTERPRISE: { label: 'Entreprise', students: 'Groupe multi-établissements', features: 'Consolidation, paramétrage et accompagnement dédié.' },
  CUSTOM: { label: 'Sur devis', students: 'Besoins spécifiques', features: 'Tarif et accompagnement personnalisés.' },
};
const subscriptionMoney = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 });

function SubscriptionPlanTab({ isSchoolAdmin }: { isSchoolAdmin: boolean }) {
  const [plans, setPlans] = useState<PlatformPlanSetting[]>([]);
  const [subscription, setSubscription] = useState<SchoolSubscription | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlanKey | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function loadSubscription() {
    setLoading(true);
    setError('');
    try {
      const [planSettings, schoolSubscription] = await Promise.all([
        apiRequest<PlatformPlanSetting[]>('/school-subscription/plans'),
        apiRequest<SchoolSubscription>('/school-subscription'),
      ]);
      setPlans(planSettings);
      setSubscription(schoolSubscription);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Impossible de charger les forfaits.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadSubscription(); }, []);

  async function submitPlanRequest() {
    if (!selectedPlan) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await apiRequest('/school-subscription/requests', { method: 'POST', body: { plan: selectedPlan } });
      setNotice('Votre demande a été envoyée à la plateforme pour validation.');
      setSelectedPlan(null);
      await loadSubscription();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Impossible d’envoyer la demande de forfait.');
    } finally {
      setSaving(false);
    }
  }

  const currentPlan = subscription ? subscriptionPlanDetails[subscription.subscriptionPlan] : null;
  const requestStatus = subscription?.request?.status;
  const requestedPlanDetails = subscription?.request ? subscriptionPlanDetails[subscription.request.plan] : null;

  return <section className="school-subscription-panel">
    <div className="school-subscription-heading"><div><p className="eyebrow">FORFAIT DE L’ÉTABLISSEMENT</p><h2>Abonnement plateforme</h2><p>Choisissez le forfait adapté à votre école. La plateforme doit valider chaque demande avant toute modification.</p></div>{currentPlan && <div className="school-current-plan"><small>FORFAIT ACTUEL</small><strong>{currentPlan.label}</strong><span>{subscriptionMoney.format(subscription!.monthlyFee)} / mois · {subscription!.subscriptionStatus === 'ACTIVE' ? 'Actif' : subscription!.subscriptionStatus === 'TRIAL' ? 'Essai' : subscription!.subscriptionStatus}</span></div>}</div>
    {error && <div className="feedback-message error-message" role="alert">{error}</div>}
    {notice && <div className="feedback-message success-message" role="status">{notice}</div>}
    {loading ? <p className="inline-hint">Chargement des forfaits…</p> : <>
      {requestStatus === 'PENDING' && requestedPlanDetails && <div className="subscription-request-status pending"><strong>Demande en attente</strong><span>Votre demande pour le forfait {requestedPlanDetails.label} attend la validation de la plateforme.</span></div>}
      {requestStatus === 'REJECTED' && requestedPlanDetails && <div className="subscription-request-status rejected"><strong>Dernière demande refusée</strong><span>Votre demande pour le forfait {requestedPlanDetails.label} a été refusée. Vous pouvez en soumettre une autre.</span></div>}
      {requestStatus === 'APPROVED' && requestedPlanDetails && <div className="subscription-request-status approved"><strong>Dernière demande approuvée</strong><span>Votre forfait {requestedPlanDetails.label} est maintenant appliqué.</span></div>}
      <div className="school-subscription-plan-grid">{plans.map(({ plan, monthlyFee }) => {
        const details = subscriptionPlanDetails[plan];
        const isCurrent = subscription?.subscriptionPlan === plan;
        const selected = selectedPlan === plan;
        return <button type="button" key={plan} className={`school-subscription-plan ${isCurrent ? 'current' : ''} ${selected ? 'selected' : ''}`} aria-pressed={selected} onClick={() => setSelectedPlan(plan)} disabled={!isSchoolAdmin || requestStatus === 'PENDING'}>
          <span className="school-plan-title"><strong>{details.label}</strong>{isCurrent && <small>Actuel</small>}</span>
          <strong className="school-plan-price">{plan === 'CUSTOM' ? 'Sur devis' : `${subscriptionMoney.format(monthlyFee)} / mois`}</strong>
          <small>{details.students}</small>
          <span className="school-plan-features">{details.features}</span>
        </button>;
      })}</div>
      {isSchoolAdmin ?       <button type="button" className="primary-button subscription-request-button" disabled={!selectedPlan || selectedPlan === subscription?.subscriptionPlan || requestStatus === 'PENDING' || saving} onClick={() => void submitPlanRequest()}>
        {saving ? 'Envoi de la demande…' : requestStatus === 'PENDING' ? 'Demande en attente de validation' : 'Demander ce forfait'}
      </button> : <p className="inline-hint">Seul l’administrateur de l’école peut demander un changement de forfait.</p>}
      <p className="subscription-disclaimer">La demande ne modifie pas immédiatement votre forfait. Le tarif et l’abonnement ne changent qu’après validation par la plateforme. Les paiements sont enregistrés manuellement.</p>
    </>}
  </section>;
}

type SubmitHandler = (event: FormEvent<HTMLFormElement>, task: () => Promise<unknown>, message: string, reset?: () => void) => Promise<void>;

function InvoicesTab({ students, feeTypes, invoices, currency, saving, submit, search, setSearch, schoolYearId }: {
  students: Student[]; feeTypes: FeeType[]; invoices: Invoice[]; currency: string; saving: boolean; submit: SubmitHandler; search: string; setSearch: (value: string) => void; schoolYearId: string;
}) {
  const { can } = useAccess();
  const [studentId, setStudentId] = useState('');
  const [feeTypeId, setFeeTypeId] = useState('');
  const [amountDue, setAmountDue] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [scheduleInvoiceId, setScheduleInvoiceId] = useState('');
  const [scheduleLabel, setScheduleLabel] = useState('');
  const [scheduleAmount, setScheduleAmount] = useState('');
  const [scheduleDate, setScheduleDate] = useState('');
  const invoiceForSchedule = invoices.find((invoice) => invoice.id === scheduleInvoiceId);

  return <>
    {can('billing', 'canCreate') && <div className="organization-grid two-column billing-forms">
      <form className="form-card" onSubmit={(event) => void submit(event, () => apiRequest<Invoice>('/invoices', { method: 'POST', body: { studentId, feeTypeId, schoolYearId, amountDue, ...(dueDate ? { dueDate } : {}) } }), 'Facture créée.', () => { setStudentId(''); setFeeTypeId(''); setAmountDue(''); setDueDate(''); })}>
        <FormHeading index="01" title="Nouvelle facture" detail="Réservé aux élèves inscrits pour l’année sélectionnée." />
        <label className="field-label">Élève<select required value={studentId} onChange={(event) => setStudentId(event.target.value)}><option value="">Choisir un élève</option>{students.filter((student) => student.isActive).map((student) => <option key={student.id} value={student.id}>{student.firstName} {student.lastName} · {student.matricule}</option>)}</select></label>
        <label className="field-label">Type de frais<select required value={feeTypeId} onChange={(event) => setFeeTypeId(event.target.value)}><option value="">Choisir un frais</option>{feeTypes.filter((fee) => fee.isActive).map((fee) => <option key={fee.id} value={fee.id}>{fee.name}</option>)}</select></label>
        <div className="form-row"><label className="field-label">Montant ({currency})<input required type="number" min="0.01" step="0.01" value={amountDue} onChange={(event) => setAmountDue(event.target.value)} /></label><label className="field-label">Date limite<input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label></div>
        <button className="primary-button" disabled={saving || !students.length || !feeTypes.some((fee) => fee.isActive)}>{saving ? 'Enregistrement…' : 'Émettre la facture'}</button>
        {(!students.length || !feeTypes.some((fee) => fee.isActive)) && <p className="inline-hint">Il faut un élève et un type de frais actifs.</p>}
      </form>
      <form className="form-card" onSubmit={(event) => void submit(event, () => apiRequest(`/invoices/${scheduleInvoiceId}/installments`, { method: 'POST', body: { label: scheduleLabel, amount: scheduleAmount, dueDate: scheduleDate } }), 'Échéance ajoutée.', () => { setScheduleLabel(''); setScheduleAmount(''); setScheduleDate(''); })}>
        <FormHeading index="02" title="Échéancier de paiement" detail={invoiceForSchedule ? `Solde restant : ${formatMoney(invoiceForSchedule.balance, currency)}` : 'Répartissez une facture en échéances.'} />
        <label className="field-label">Facture<select required value={scheduleInvoiceId} onChange={(event) => setScheduleInvoiceId(event.target.value)}><option value="">Choisir une facture</option>{invoices.filter((invoice) => invoice.balance !== '0.00').map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.invoiceNumber} · {invoice.student.lastName} · solde {formatMoney(invoice.balance, currency)}</option>)}</select></label>
        <label className="field-label">Libellé<input required maxLength={80} value={scheduleLabel} onChange={(event) => setScheduleLabel(event.target.value)} placeholder="1ère tranche" /></label>
        <div className="form-row"><label className="field-label">Montant<input required type="number" min="0.01" step="0.01" value={scheduleAmount} onChange={(event) => setScheduleAmount(event.target.value)} /></label><label className="field-label">Date prévue<input required type="date" value={scheduleDate} onChange={(event) => setScheduleDate(event.target.value)} /></label></div>
        <button className="primary-button" disabled={saving || !scheduleInvoiceId}>{saving ? 'Enregistrement…' : 'Ajouter l’échéance'}</button>
      </form>
    </div>}
    <div className="configured-list"><div className="section-heading"><div><p className="eyebrow">ANNÉE SÉLECTIONNÉE</p><h2>Factures ({invoices.length})</h2></div><label className="list-search"><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nom, matricule, facture" aria-label="Rechercher une facture" /></label></div>
      {invoices.length ? <div className="records-list">{invoices.map((invoice) => <div className="record-row invoice-record" key={invoice.id}><span className={`invoice-status ${invoice.status.toLowerCase()}`}>{invoice.status === 'PAID' ? 'Soldée' : invoice.status === 'PARTIAL' ? 'Partielle' : 'À payer'}</span><div><strong>{invoice.invoiceNumber} · {invoice.student.firstName} {invoice.student.lastName}</strong><small>{invoice.feeType.name} · {invoice.installments.length} échéance(s){invoice.dueDate ? ` · limite ${formatDate(invoice.dueDate)}` : ''}</small></div><div className="invoice-amounts"><small>Facturé {formatMoney(invoice.amountDue, currency)}</small><strong>Solde {formatMoney(invoice.balance, currency)}</strong></div></div>)}</div> : <Empty text="Aucune facture. Créez-en une à l’aide du formulaire." />}
    </div>
  </>;
}

function PaymentsTab({ invoices, payments, schoolYears, currency, saving, submit, openReceipt, cancelPayment }: {
  invoices: Invoice[]; payments: Payment[]; schoolYears: SchoolYear[]; currency: string; saving: boolean; submit: SubmitHandler; openReceipt: (payment: Payment) => Promise<void>; cancelPayment: (payment: Payment) => Promise<void>;
}) {
  const { can } = useAccess();
  const [method, setMethod] = useState('CASH');
  const [providerReference, setProviderReference] = useState('');
  const [allocations, setAllocations] = useState<AllocationDraft[]>([{ invoiceId: '', amount: '' }]);
  const [draftInvoiceId, setDraftInvoiceId] = useState('');
  const [draftAmount, setDraftAmount] = useState('');
  const [historyStudentId, setHistoryStudentId] = useState('');
  const [historySelectedStudent, setHistorySelectedStudent] = useState<Student | null>(null);
  const [historySchoolYearId, setHistorySchoolYearId] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [studentSearchResults, setStudentSearchResults] = useState<Student[]>([]);
  const [studentSearchLoading, setStudentSearchLoading] = useState(false);
  const [studentSearchError, setStudentSearchError] = useState('');
  const [studentPayments, setStudentPayments] = useState<Payment[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const total = allocations.reduce((sum, allocation) => sum + (Number(allocation.amount) || 0), 0);
  const selectedInvoiceIds = new Set(allocations.map((allocation) => allocation.invoiceId).filter(Boolean));
  function reset() { setMethod('CASH'); setProviderReference(''); setAllocations([{ invoiceId: '', amount: '' }]); setDraftInvoiceId(''); setDraftAmount(''); }

  async function searchStudents(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = studentSearch.trim();
    setStudentSearchResults([]);
    setStudentSearchError('');
    if (!query) {
      setStudentSearchError('Saisissez un nom, un prénom ou un matricule.');
      return;
    }
    setHistoryStudentId('');
    setHistorySelectedStudent(null);
    setStudentPayments([]);
    setStudentSearchLoading(true);
    try {
      const params = new URLSearchParams({ page: '1', pageSize: '100', search: query });
      const response = await apiRequest<{ data: Student[] }>(`/students?${params.toString()}`);
      setStudentSearchResults(response.data);
      if (!response.data.length) setStudentSearchError('Aucun élève ne correspond à cette recherche.');
    } catch (requestError) {
      setStudentSearchError(requestError instanceof Error ? requestError.message : 'Impossible de rechercher les élèves.');
    } finally {
      setStudentSearchLoading(false);
    }
  }

  useEffect(() => {
    if (!historyStudentId) {
      setStudentPayments([]);
      setHistoryError('');
      setHistoryLoading(false);
      return;
    }
    let cancelled = false;
    const params = new URLSearchParams({ studentId: historyStudentId });
    if (historySchoolYearId) params.set('schoolYearId', historySchoolYearId);
    setHistoryLoading(true);
    setHistoryError('');
    void apiRequest<Payment[]>(`/payments?${params.toString()}`)
      .then((history) => { if (!cancelled) setStudentPayments(history); })
      .catch((requestError) => {
        if (!cancelled) setHistoryError(requestError instanceof Error ? requestError.message : 'Impossible de charger l’historique de paiement.');
      })
      .finally(() => { if (!cancelled) setHistoryLoading(false); });
    return () => { cancelled = true; };
  }, [historyStudentId, historySchoolYearId]);

  const historyTotalPaid = studentPayments
    .filter((payment) => payment.status === 'RECORDED')
    .reduce((sum, payment) => sum + payment.allocations
      .filter((allocation) => allocation.invoice.student.id === historyStudentId)
      .reduce((allocationSum, allocation) => allocationSum + Number(allocation.amount), 0), 0);
  const historyRecordedCount = studentPayments.filter((payment) => payment.status === 'RECORDED').length;
  const historyCancelledCount = studentPayments.filter((payment) => payment.status === 'CANCELLED').length;

  return <div className="organization-grid two-column billing-forms">
    {can('billing', 'canCreate') && <form className="form-card" onSubmit={(event) => void submit(event, () => apiRequest<Payment>('/payments', { method: 'POST', body: { amount: total.toFixed(2), method, ...(providerReference.trim() ? { providerReference: providerReference.trim() } : {}), allocations: allocations.filter((item) => item.invoiceId && item.amount).map((item) => ({ invoiceId: item.invoiceId, amount: item.amount })) } }), 'Paiement enregistré et reçu généré.', reset)}>
      <FormHeading index="01" title="Enregistrer un paiement" detail="Un paiement partiel ou réparti entre plusieurs factures est possible." />
      <label className="field-label">Moyen de paiement<select value={method} onChange={(event) => setMethod(event.target.value)}><optgroup label="Paiement local"><option value="CASH">Espèces</option><option value="BANK_TRANSFER">Virement bancaire</option><option value="CHEQUE">Chèque</option></optgroup><optgroup label="Mobile money — Niger"><option value="AIRTEL_MONEY">Airtel Money</option><option value="MOOV_MONEY">Moov Money</option><option value="ZAMANI_CASH">Zamani Cash</option></optgroup><optgroup label="Agences de transfert présentes au Niger"><option value="WESTERN_UNION">Western Union</option><option value="MONEYGRAM">MoneyGram</option></optgroup><option value="OTHER">Autre</option></select></label>
      {['AIRTEL_MONEY', 'MOOV_MONEY', 'ZAMANI_CASH', 'WESTERN_UNION', 'MONEYGRAM'].includes(method) && <label className="field-label">Référence opérateur / agence<input maxLength={100} value={providerReference} onChange={(event) => setProviderReference(event.target.value)} placeholder="Numéro de transaction ou reçu" /><small className="field-hint">Saisissez la référence figurant sur le reçu ou le SMS de confirmation.</small></label>}
      <div className="allocation-builder">{allocations.map((allocation, index) => <div className="form-row allocation-row" key={`${index}-${allocation.invoiceId}`}><label className="field-label">Facture<select required value={allocation.invoiceId} onChange={(event) => setAllocations((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, invoiceId: event.target.value } : item))}><option value="">Choisir une facture ouverte</option>{invoices.filter((invoice) => invoice.balance !== '0.00' && (!selectedInvoiceIds.has(invoice.id) || invoice.id === allocation.invoiceId)).map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.invoiceNumber} · {invoice.student.lastName} · {formatMoney(invoice.balance, currency)}</option>)}</select></label><label className="field-label">Affecté ({currency})<input required type="number" min="0.01" max={invoices.find((invoice) => invoice.id === allocation.invoiceId)?.balance} step="0.01" value={allocation.amount} onChange={(event) => setAllocations((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, amount: event.target.value } : item))} /></label>{allocations.length > 1 && <button type="button" className="remove-allocation" aria-label="Retirer la répartition" onClick={() => setAllocations((current) => current.filter((_, itemIndex) => itemIndex !== index))}>×</button>}</div>)}</div>
      <div className="allocation-add-row"><select aria-label="Facture à ajouter" value={draftInvoiceId} onChange={(event) => setDraftInvoiceId(event.target.value)}><option value="">Ajouter une autre facture…</option>{invoices.filter((invoice) => invoice.balance !== '0.00' && !selectedInvoiceIds.has(invoice.id)).map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.invoiceNumber} · {invoice.student.lastName}</option>)}</select><input aria-label="Montant à répartir" type="number" min="0.01" step="0.01" value={draftAmount} onChange={(event) => setDraftAmount(event.target.value)} placeholder="Montant" /><button type="button" className="secondary-button" disabled={!draftInvoiceId || !draftAmount} onClick={() => { setAllocations((current) => [...current, { invoiceId: draftInvoiceId, amount: draftAmount }]); setDraftInvoiceId(''); setDraftAmount(''); }}>Ajouter</button></div>
      <div className="payment-total"><span>Total encaissé</span><strong>{formatMoney(total.toFixed(2), currency)}</strong></div>
      <button className="primary-button" disabled={saving || !allocations.length || allocations.some((item) => !item.invoiceId || !item.amount) || total <= 0}>{saving ? 'Enregistrement…' : 'Enregistrer et créer le reçu'}</button>
    </form>}
    <div className="form-card"><FormHeading index="02" title="Paiements et reçus" detail="L’historique conserve les annulations avec leur motif." />
      {payments.length ? <div className="payment-list">{payments.map((payment) => <div className="payment-record" key={payment.id}><div className="payment-record-heading"><div><strong>{payment.receiptNumber}</strong><small>{formatDateTime(payment.receivedAt)} · {PAYMENT_METHOD_LABELS[payment.method] ?? payment.method}{payment.providerReference ? ` · Réf. ${payment.providerReference}` : ''}</small></div><strong>{formatMoney(payment.amount, currency)}</strong></div><div className="payment-meta"><span className={`payment-status ${payment.status.toLowerCase()}`}>{payment.status === 'RECORDED' ? 'Enregistré' : payment.status === 'CANCELLED' ? 'Annulé' : 'Remboursé'}</span><span>{payment.allocations.map((allocation) => allocation.invoice.invoiceNumber).join(', ')}</span></div>{payment.cancellationReason && <small className="cancel-reason">Motif : {payment.cancellationReason}</small>}<div className="payment-actions"><button className="table-action" onClick={() => void openReceipt(payment)}>Voir le reçu</button>{payment.status === 'RECORDED' && can('billing', 'canUpdate') && <button className="table-action danger-action" disabled={saving} onClick={() => void cancelPayment(payment)}>Annuler le paiement</button>}</div></div>)}</div> : <Empty text="Aucun paiement enregistré pour cette année." />}
    </div>
    <section className="form-card student-payment-history" aria-labelledby="student-payment-history-title">
      <div className="section-heading student-history-heading">
        <div><p className="eyebrow">SUIVI INDIVIDUEL</p><h2 id="student-payment-history-title">Historique des paiements de scolarité</h2><span className="section-note">Consultez les règlements, reçus et annulations d’un élève.</span></div>
        <div className="student-history-filters">
          <form className="student-history-search" onSubmit={(event) => void searchStudents(event)}>
            <label className="field-label">Rechercher un élève<input type="search" value={studentSearch} onChange={(event) => { setStudentSearch(event.target.value); setStudentSearchError(''); }} placeholder="Nom, prénom ou matricule" /></label>
            <button className="secondary-button" type="submit" disabled={studentSearchLoading}>{studentSearchLoading ? 'Recherche…' : 'Rechercher'}</button>
          </form>
          <label className="field-label">Année scolaire<select value={historySchoolYearId} onChange={(event) => setHistorySchoolYearId(event.target.value)}><option value="">Toutes les années</option>{schoolYears.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}</select></label>
        </div>
      </div>
      {studentSearchError && <div className="feedback-message error-message" role="alert">{studentSearchError}</div>}
      {studentSearchResults.length > 0 && <div className="student-search-results" aria-label="Résultats de recherche des élèves">{studentSearchResults.map((student) => <button className={`student-search-result ${historyStudentId === student.id ? 'selected' : ''}`} type="button" key={student.id} onClick={() => { setHistoryStudentId(student.id); setHistorySelectedStudent(student); setStudentSearchResults([]); }}><span><strong>{student.firstName} {student.lastName}</strong><small>Matricule : {student.matricule}</small></span><span aria-hidden="true">{historyStudentId === student.id ? 'Sélectionné' : 'Afficher l’historique'}</span></button>)}</div>}
      {historyStudentId && <div className="student-history-selected"><span>Élève sélectionné : <strong>{historySelectedStudent ? `${historySelectedStudent.firstName} ${historySelectedStudent.lastName} · ${historySelectedStudent.matricule}` : 'Dossier élève'}</strong></span><button className="table-action" type="button" onClick={() => { setHistoryStudentId(''); setHistorySelectedStudent(null); setStudentPayments([]); }}>Changer d’élève</button></div>}
      {!historyStudentId ? <Empty text="Recherchez un élève par son nom, son prénom ou son matricule, puis sélectionnez-le pour consulter son historique." />
        : historyLoading ? <p className="inline-hint">Chargement de l’historique de l’élève…</p>
          : historyError ? <div className="feedback-message error-message" role="alert">{historyError}</div>
            : <>
              <div className="student-history-summary">
                <SummaryCard label="Total encaissé" value={formatMoney(historyTotalPaid.toFixed(2), currency)} detail="Hors paiements annulés" />
                <SummaryCard label="Paiements validés" value={String(historyRecordedCount)} detail="Reçus actifs" />
                <SummaryCard label="Paiements annulés" value={String(historyCancelledCount)} detail="Conservés pour traçabilité" />
              </div>
              {studentPayments.length ? <div className="payment-list">{studentPayments.map((payment) => {
                const studentAllocations = payment.allocations.filter((allocation) => allocation.invoice.student.id === historyStudentId);
                const studentAmount = studentAllocations.reduce((sum, allocation) => sum + Number(allocation.amount), 0);
                return <article className="payment-record student-history-record" key={payment.id}>
                  <div className="payment-record-heading"><div><strong>{payment.receiptNumber}</strong><small>{formatDateTime(payment.receivedAt)} · {PAYMENT_METHOD_LABELS[payment.method] ?? payment.method}{payment.providerReference ? ` · Réf. ${payment.providerReference}` : ''}</small></div><strong>{formatMoney(studentAmount.toFixed(2), currency)}</strong></div>
                  <div className="payment-meta"><span className={`payment-status ${payment.status.toLowerCase()}`}>{payment.status === 'RECORDED' ? 'Enregistré' : payment.status === 'CANCELLED' ? 'Annulé' : 'Remboursé'}</span><span>{studentAllocations.length} facture(s) concernée(s)</span></div>
                  <div className="student-history-lines">{studentAllocations.map((allocation) => <div className="student-history-line" key={allocation.id}><span>{allocation.invoice.feeType.name} · {allocation.invoice.schoolYear.name} · {allocation.invoice.invoiceNumber}</span><strong>{formatMoney(allocation.amount, currency)}</strong></div>)}</div>
                  {payment.cancellationReason && <small className="cancel-reason">Motif d’annulation : {payment.cancellationReason}</small>}
                  <div className="payment-actions"><button className="table-action" onClick={() => void openReceipt(payment)}>Voir le reçu</button>{payment.status === 'RECORDED' && <button className="table-action danger-action" disabled={saving} onClick={() => void cancelPayment(payment)}>Annuler le paiement</button>}</div>
                </article>;
              })}</div> : <Empty text="Aucun paiement trouvé pour cet élève sur la période sélectionnée." />}
            </>}
    </section>
  </div>;
}

function FeeTypesTab({ feeTypes, saving, submit, toggleFeeType }: { feeTypes: FeeType[]; saving: boolean; submit: SubmitHandler; toggleFeeType: (fee: FeeType) => Promise<void> }) {
  const { can } = useAccess();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  return <div className="organization-grid two-column">{can('billing', 'canCreate') && <form className="form-card" onSubmit={(event) => void submit(event, () => apiRequest('/fee-types', { method: 'POST', body: { name, ...(description ? { description } : {}) } }), 'Type de frais créé.', () => { setName(''); setDescription(''); })}>
    <FormHeading index="01" title="Créer un type de frais" detail="Exemples : inscription, scolarité, fournitures, transport." />
    <label className="field-label">Nom<input required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="Frais de scolarité" /></label>
    <label className="field-label">Description<input maxLength={240} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
    <button className="primary-button" disabled={saving}>{saving ? 'Enregistrement…' : 'Ajouter le type de frais'}</button>
  </form>}<div className="records-list">{feeTypes.map((fee) => <div className="record-row" key={fee.id}><span className={`student-status ${fee.isActive ? 'active' : 'archived'}`}>{fee.isActive ? 'Actif' : 'Archivé'}</span><div><strong>{fee.name}</strong><small>{fee.description ?? 'Sans description'} · {fee._count?.invoices ?? 0} facture(s)</small></div>{can('billing', 'canUpdate') && <button className="table-action" onClick={() => void toggleFeeType(fee)}>{fee.isActive ? 'Archiver' : 'Réactiver'}</button>}</div>)}{!feeTypes.length && <Empty text="Aucun type de frais configuré." />}</div></div>;
}

function BalancesTab({ invoices, currency, search, setSearch }: { invoices: Invoice[]; currency: string; search: string; setSearch: (value: string) => void }) {
  const openInvoices = invoices.filter((invoice) => invoice.balance !== '0.00');
  return <div className="form-card"><div className="section-heading balance-heading"><div><p className="eyebrow">SUIVI DES SOLDES</p><h2>Factures à régler ({openInvoices.length})</h2></div><label className="list-search"><span aria-hidden="true">⌕</span><input aria-label="Rechercher dans les soldes" placeholder="Élève ou matricule" value={search} onChange={(event) => setSearch(event.target.value)} /></label></div>{openInvoices.length ? <div className="records-list">{openInvoices.map((invoice) => <div className="record-row invoice-record" key={invoice.id}><span className={`invoice-status ${invoice.status.toLowerCase()}`}>{invoice.status === 'PARTIAL' ? 'Partielle' : 'À payer'}</span><div><strong>{invoice.student.firstName} {invoice.student.lastName} · {invoice.student.matricule}</strong><small>{invoice.invoiceNumber} · {invoice.feeType.name} · {invoice.schoolYear.name}</small></div><div className="invoice-amounts"><small>Payé {formatMoney(invoice.amountPaid, currency)}</small><strong>Reste {formatMoney(invoice.balance, currency)}</strong></div></div>)}</div> : <Empty text="Aucun solde restant pour cette recherche." />}</div>;
}

function ReceiptDialog({ receipt, currency, profile, onClose }: { receipt: Receipt; currency: string; profile: SchoolProfile | null; onClose: () => void }) {
  const address = [profile?.address, [profile?.city, profile?.country].filter(Boolean).join(', ')].filter(Boolean).join(' · ');
  const contactDetails = [profile?.phone, profile?.email, profile?.website, profile?.registrationId ? `N° ${profile.registrationId}` : null].filter(Boolean).join(' · ');

  return <div className="receipt-backdrop" role="presentation" onClick={onClose}><section className="receipt-dialog" role="dialog" aria-modal="true" aria-labelledby="receipt-title" onClick={(event) => event.stopPropagation()}>
    <header className="receipt-school-header">{profile?.logoDataUrl && <img className="receipt-logo" src={profile.logoDataUrl} alt={`Logo ${profile.name}`} />}<strong>{profile?.name || 'Établissement scolaire'}</strong>{profile?.shortName && profile.shortName !== profile.name && <span>{profile.shortName}</span>}{address && <span>{address}</span>}{contactDetails && <span>{contactDetails}</span>}</header>
    <div className="receipt-head"><div><p className="eyebrow">REÇU DE PAIEMENT</p><h2 id="receipt-title">{receipt.receiptNumber}</h2></div><button className="receipt-close" onClick={onClose} aria-label="Fermer">×</button></div>
    <p className="receipt-date">{formatDateTime(receipt.receivedAt)} · {PAYMENT_METHOD_LABELS[receipt.method] ?? receipt.method}{receipt.providerReference ? ` · Réf. ${receipt.providerReference}` : ''}</p>{receipt.status === 'CANCELLED' && <p className="receipt-cancelled">ANNULÉ — {receipt.cancellationReason}</p>}<div className="records-list receipt-lines">{receipt.allocations.map((line, index) => <div className="record-row" key={`${line.invoiceNumber}-${index}`}><div><strong>{line.studentName} · {line.matricule}</strong><small>{line.feeName} · facture {line.invoiceNumber} · {line.schoolYear}</small></div><strong>{formatMoney(line.amount, currency)}</strong></div>)}</div><div className="payment-total"><span>Montant du reçu</span><strong>{formatMoney(receipt.amount, currency)}</strong></div><div className="receipt-actions"><button className="secondary-button" onClick={() => window.print()}>Imprimer</button><button className="primary-button" onClick={onClose}>Fermer</button></div>
  </section></div>;
}

function FormHeading({ index, title, detail }: { index: string; title: string; detail: string }) {
  return <div className="form-card-heading"><span className="module-number">{index}</span><div><strong>{title}</strong><small>{detail}</small></div></div>;
}

function SummaryCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <article className="billing-summary-card"><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>;
}

function Empty({ text }: { text: string }) {
  return <div className="list-empty"><strong>Rien à afficher</strong><span>{text}</span></div>;
}

function formatMoney(value: string, currency: string) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value));
}

function formatDate(value: string) { return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(value)); }
function formatDateTime(value: string) { return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }