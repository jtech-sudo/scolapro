import { FormEvent, useEffect, useState } from 'react';
import { apiRequest } from './api';

type SchoolRef = { id: string; name: string };
type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'MOBILE_MONEY' | 'OTHER';
type SubscriptionPayment = {
  id: string;
  schoolId: string;
  amount: number;
  paidAt: string;
  period: string;
  method: PaymentMethod;
  reference: string | null;
  note: string | null;
  school: { id: string; name: string };
};

const methods: Array<[PaymentMethod, string]> = [
  ['CASH', 'Espèces'],
  ['BANK_TRANSFER', 'Virement bancaire'],
  ['MOBILE_MONEY', 'Mobile money'],
  ['OTHER', 'Autre'],
];
const money = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 });

function localDate() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

export function PlatformPayments({ schools }: { schools: SchoolRef[] }) {
  const [payments, setPayments] = useState<SubscriptionPayment[]>([]);
  const [schoolId, setSchoolId] = useState('');
  const [amount, setAmount] = useState('');
  const [paidAt, setPaidAt] = useState(localDate);
  const [period, setPeriod] = useState(() => localDate().slice(0, 7));
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');

  async function refreshPayments() {
    setPayments(await apiRequest<SubscriptionPayment[]>('/platform/subscription-payments'));
  }

  useEffect(() => {
    let mounted = true;
    void refreshPayments()
      .catch((requestError) => { if (mounted) setError(requestError instanceof Error ? requestError.message : 'Impossible de charger les paiements.'); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  async function recordPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSaved('');
    try {
      await apiRequest('/platform/subscription-payments', {
        method: 'POST',
        body: { schoolId, amount: Number(amount), paidAt, period, method, reference: reference.trim() || undefined, note: note.trim() || undefined },
      });
      setSaved('Paiement enregistré.');
      setAmount('');
      setReference('');
      setNote('');
      await refreshPayments();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Impossible d’enregistrer le paiement.');
    } finally { setSaving(false); }
  }

  const total = payments.reduce((sum, payment) => sum + payment.amount, 0);

  return <section className="platform-table-card platform-admin-page" id="payments">
    <div className="platform-table-heading"><div><span className="platform-section-kicker">SUIVI MANUEL</span><h2>Paiements d’abonnement</h2><p>Enregistrez les versements reçus hors plateforme; aucun paiement n’est encaissé automatiquement.</p></div><strong className="platform-payment-total">{money.format(total)}</strong></div>
    <form className="platform-payment-form" onSubmit={(event) => void recordPayment(event)}>
      <label className="field-label">École<select required value={schoolId} onChange={(event) => setSchoolId(event.target.value)}><option value="">Choisir une école</option>{schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}</select></label>
      <label className="field-label">Montant (FCFA)<input required type="number" min="1" max="100000000" step="1" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
      <label className="field-label">Date du paiement<input required type="date" value={paidAt} onChange={(event) => setPaidAt(event.target.value)} /></label>
      <label className="field-label">Période<input required type="month" value={period} onChange={(event) => setPeriod(event.target.value)} /></label>
      <label className="field-label">Mode<select value={method} onChange={(event) => setMethod(event.target.value as PaymentMethod)}>{methods.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="field-label">Référence (facultatif)<input maxLength={120} value={reference} onChange={(event) => setReference(event.target.value)} /></label>
      <label className="field-label platform-payment-note">Note (facultative)<input maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} /></label>
      <button className="primary-button platform-create-button" disabled={saving || schools.length === 0}>{saving ? 'Enregistrement…' : 'Enregistrer le paiement'}</button>
    </form>
    {error && <p className="platform-admin-feedback" role="alert">{error}</p>}
    {saved && <p className="platform-admin-success" role="status">{saved}</p>}
    {loading ? <p className="platform-empty">Chargement des paiements…</p> : !payments.length ? <p className="platform-empty">Aucun paiement enregistré.</p> : <div className="platform-admin-table-wrap"><table className="platform-admin-table"><thead><tr><th>Date</th><th>École</th><th>Période</th><th>Montant</th><th>Mode</th><th>Référence</th></tr></thead><tbody>{payments.map((payment) => <tr key={payment.id}><td>{new Intl.DateTimeFormat('fr-FR').format(new Date(payment.paidAt))}</td><td>{payment.school.name}</td><td>{payment.period}</td><td><strong>{money.format(payment.amount)}</strong></td><td>{methods.find(([value]) => value === payment.method)?.[1] ?? 'Autre'}</td><td>{payment.reference || '—'}</td></tr>)}</tbody></table></div>}
  </section>;
}
