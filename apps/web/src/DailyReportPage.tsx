import { useEffect, useState } from 'react';
import { apiRequest } from './api';

type DailyReport = {
  date: string;
  summary: {
    newStudents: number;
    attendanceSessions: number;
    attendanceRecords: number;
    present: number;
    absent: number;
    late: number;
    excused: number;
    paymentCount: number;
    payments: string;
    expenseCount: number;
    expenses: string;
    invoiceCount: number;
    invoiced: string;
    activityCount: number;
  };
  attendance: Array<{ id: string; className: string; slot: string; studentCount: number; present: number; absent: number; late: number; excused: number }>;
  students: Array<{ id: string; firstName: string; lastName: string; matricule: string; createdAt: string }>;
  payments: Array<{ id: string; receiptNumber: string; amount: string; method: string; receivedAt: string }>;
  expenses: Array<{ id: string; reference: string; description: string; amount: string; spentAt: string; category: string }>;
  invoices: Array<{ id: string; invoiceNumber: string; studentName: string; matricule: string; feeType: string; amountDue: string; createdAt: string }>;
  activities: Array<{ id: string; action: string; entityType: string; createdAt: string }>;
};

const today = new Date().toISOString().slice(0, 10);

export function DailyReportPage({ onBack }: { onBack: () => void }) {
  const [date, setDate] = useState(today);
  const [report, setReport] = useState<DailyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    void apiRequest<DailyReport>(`/statistics/daily?date=${encodeURIComponent(date)}`)
      .then((result) => { if (!cancelled) setReport(result); })
      .catch((requestError) => { if (!cancelled) setError(requestError instanceof Error ? requestError.message : 'Impossible de charger le rapport journalier.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [date]);

  const summary = report?.summary;
  const metrics = [
    ['Nouveaux élèves', String(summary?.newStudents ?? 0), 'Dossiers créés ce jour'],
    ['Appels effectués', String(summary?.attendanceSessions ?? 0), `${summary?.attendanceRecords ?? 0} présence(s) enregistrée(s)`],
    ['Paiements encaissés', formatMoney(summary?.payments ?? '0'), `${summary?.paymentCount ?? 0} reçu(s)`],
    ['Dépenses enregistrées', formatMoney(summary?.expenses ?? '0'), `${summary?.expenseCount ?? 0} dépense(s)`],
    ['Factures émises', formatMoney(summary?.invoiced ?? '0'), `${summary?.invoiceCount ?? 0} facture(s)`],
  ];

  return <section className="workspace-page daily-report-page">
    <button className="back-link" onClick={onBack}>← Retour à la vue générale</button>
    <div className="workspace-title-row"><div><p className="eyebrow">PILOTAGE DE L’ÉTABLISSEMENT</p><h1>Statistiques et rapport journalier</h1><p>Activités scolaires et financières enregistrées pour une journée.</p></div><div className="daily-report-actions"><label className="field-label">Date du rapport<input aria-label="Date du rapport" type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label><button className="secondary-button" type="button" onClick={() => window.print()}>Imprimer le rapport</button></div></div>
    {error && <div className="feedback-message error-message" role="alert">{error}</div>}
    {loading && <p className="inline-hint">Chargement du rapport…</p>}
    {!loading && report && <div className="daily-report-print">
      <p className="daily-report-date">Rapport du {new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full', timeZone: 'UTC' }).format(new Date(`${report.date}T12:00:00Z`))}</p>
      <div className="daily-report-metrics">{metrics.map(([label, value, detail]) => <article className="daily-report-metric" key={label}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>)}</div>
      <section className="daily-report-section"><div className="section-heading"><div><p className="eyebrow">SUIVI SCOLAIRE</p><h2>Présences du jour</h2></div><span className="section-note">{summary?.present ?? 0} présent(s) · {summary?.absent ?? 0} absent(s) · {summary?.late ?? 0} retard(s) · {summary?.excused ?? 0} excusé(s)</span></div>
        {report.attendance.length ? <div className="records-list">{report.attendance.map((session) => <div className="record-row" key={session.id}><div><strong>{session.className}</strong><small>{slotLabel(session.slot)} · {session.studentCount} élève(s)</small></div><span className="daily-session-counts">{session.present} P · {session.absent} A · {session.late} R · {session.excused} E</span></div>)}</div> : <Empty text="Aucun appel n’a été enregistré à cette date." />}
      </section>
      <section className="daily-report-section"><div className="section-heading"><div><p className="eyebrow">OPÉRATIONS DU JOUR</p><h2>Inscriptions, factures et mouvements</h2></div></div><div className="daily-report-columns">
        <ActivityList title="Nouveaux élèves" empty="Aucune inscription ce jour." rows={report.students.map((student) => ({ id: student.id, title: `${student.firstName} ${student.lastName}`, detail: student.matricule, date: student.createdAt }))} />
        <ActivityList title="Factures émises" empty="Aucune facture créée ce jour." rows={report.invoices.map((invoice) => ({ id: invoice.id, title: `${invoice.invoiceNumber} · ${invoice.studentName}`, detail: `${invoice.feeType} · ${formatMoney(invoice.amountDue)}`, date: invoice.createdAt }))} />
        <ActivityList title="Paiements reçus" empty="Aucun paiement enregistré ce jour." rows={report.payments.map((payment) => ({ id: payment.id, title: `${payment.receiptNumber} · ${formatMoney(payment.amount)}`, detail: payment.method, date: payment.receivedAt }))} />
        <ActivityList title="Dépenses enregistrées" empty="Aucune dépense ce jour." rows={report.expenses.map((expense) => ({ id: expense.id, title: `${expense.reference} · ${formatMoney(expense.amount)}`, detail: `${expense.category} · ${expense.description}`, date: expense.spentAt }))} />
      </div></section>
      <section className="daily-report-section"><div className="section-heading"><div><p className="eyebrow">TRAÇABILITÉ</p><h2>Journal des activités</h2></div><span className="section-note">{summary?.activityCount ?? 0} événement(s)</span></div>
        {report.activities.length ? <div className="records-list">{report.activities.map((activity) => <div className="record-row" key={activity.id}><div><strong>{actionLabel(activity.action)}</strong><small>{activity.entityType}</small></div><time>{formatTime(activity.createdAt)}</time></div>)}</div> : <Empty text="Aucun événement d’audit enregistré ce jour." />}
      </section>
    </div>}
  </section>;
}

function ActivityList({ title, empty, rows }: { title: string; empty: string; rows: Array<{ id: string; title: string; detail: string; date: string }> }) {
  return <section className="daily-activity-list"><h3>{title}<span>{rows.length}</span></h3>{rows.length ? <div className="records-list">{rows.map((row) => <div className="record-row" key={row.id}><div><strong>{row.title}</strong><small>{row.detail}</small></div><time>{formatTime(row.date)}</time></div>)}</div> : <p className="inline-hint">{empty}</p>}</section>;
}

function Empty({ text }: { text: string }) {
  return <div className="list-empty"><strong>Rien à afficher</strong><span>{text}</span></div>;
}

function formatMoney(value: string) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 2 }).format(Number(value));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function slotLabel(slot: string) {
  const labels: Record<string, string> = { MORNING: 'Matin', AFTERNOON: 'Après-midi', EVENING: 'Soir' };
  return labels[slot] ?? slot;
}

function actionLabel(action: string) {
  const labels: Record<string, string> = {
    ATTENDANCE_SESSION_OPENED: 'Appel ouvert',
    ATTENDANCE_RECORDS_SAVED: 'Présences enregistrées',
    STUDENT_CREATED: 'Élève inscrit',
    INVOICE_CREATED: 'Facture créée',
    PAYMENT_CREATED: 'Paiement enregistré',
    EXPENSE_CREATED: 'Dépense enregistrée',
    REPORT_CARDS_GENERATED: 'Bulletins générés',
    USER_SIGNED_IN: 'Connexion utilisateur',
    PAYMENT_RECORDED: 'Paiement enregistré',
    LEVEL_UPDATED: 'Niveau modifié',
    FEE_TYPE_CREATED: 'Type de frais créé',
    CLASS_CREATED: 'Classe créée',
    LEVEL_CREATED: 'Niveau créé',
    SCHOOL_YEAR_CREATED: 'Année scolaire créée',
    'user signed in': 'Connexion utilisateur',
    'payment recorded': 'Paiement enregistré',
    'level updated': 'Niveau modifié',
    'fee type created': 'Type de frais créé',
    'class created': 'Classe créée',
    'level created': 'Niveau créé',
    'school year created': 'Année scolaire créée',
    'student created': 'Élève inscrit',
  };
  return labels[action] ?? action.toLocaleLowerCase('fr').replaceAll('_', ' ');
}
