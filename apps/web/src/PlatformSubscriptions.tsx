import { FormEvent, useEffect, useMemo, useState } from 'react';
import { apiRequest, PlatformPlanSetting, SubscriptionPlanKey } from './api';
import { getSchoolColorStyle } from './schoolColors';

export type SchoolSubscriptionRecord = {
  id: string;
  name: string;
  subscriptionPlan: 'STARTER' | 'PRO' | 'PREMIUM' | 'ENTERPRISE' | 'CUSTOM';
  subscriptionStatus: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED' | 'CANCELED';
  monthlyFee: number;
  subscriptionStartedAt: string | null;
  subscriptionRenewalAt: string | null;
};

const plans = [
  { id: 'STARTER', label: 'Starter', price: 10000, students: 'Jusqu’à 150 élèves', features: 'Inscriptions, classes, notes, bulletins et frais scolaires' },
  { id: 'PRO', label: 'Pro', price: 25000, students: 'Jusqu’à 500 élèves', features: 'Starter + comptabilité, rapports, enseignants et présences' },
  { id: 'PREMIUM', label: 'Premium', price: 50000, students: 'Jusqu’à 1 000 élèves', features: 'Gestion complète, rapports avancés et portail parents' },
  { id: 'ENTERPRISE', label: 'Entreprise', price: 100000, students: 'Groupe multi-établissements', features: 'Consolidation, paramétrage et accompagnement dédié' },
  { id: 'CUSTOM', label: 'Sur devis', price: 0, students: 'Besoins spécifiques', features: 'Tarif et accompagnement personnalisés' },
] as const;

const statuses = [
  ['TRIAL', 'Essai'], ['ACTIVE', 'Actif'], ['PAST_DUE', 'En retard'], ['SUSPENDED', 'Suspendu'], ['CANCELED', 'Résilié'],
] as const;

const money = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 });

type SubscriptionPlanRequest = {
  id: string;
  plan: SubscriptionPlanKey;
  requestedAt: string;
  school: { id: string; name: string; subscriptionPlan: SubscriptionPlanKey; subscriptionStatus: SchoolSubscriptionRecord['subscriptionStatus'] };
};

export function PlatformSubscriptions({ schools, planSettings, onUpdated }: { schools: SchoolSubscriptionRecord[]; planSettings: PlatformPlanSetting[]; onUpdated: () => Promise<void> }) {
  const [requests, setRequests] = useState<SubscriptionPlanRequest[]>([]);
  const [requestError, setRequestError] = useState('');
  const [reviewingId, setReviewingId] = useState('');
  const activeSubscriptions = schools.filter((school) => school.subscriptionStatus === 'ACTIVE');
  const monthlyRevenue = activeSubscriptions.reduce((sum, school) => sum + school.monthlyFee, 0);

  async function loadRequests() {
    setRequestError('');
    try {
      setRequests(await apiRequest<SubscriptionPlanRequest[]>('/platform/subscription-plan-requests'));
    } catch (requestError) {
      setRequestError(requestError instanceof Error ? requestError.message : 'Impossible de charger les demandes de forfait.');
    }
  }

  useEffect(() => { void loadRequests(); }, []);

  async function reviewRequest(request: SubscriptionPlanRequest, status: 'APPROVED' | 'REJECTED') {
    setReviewingId(request.id);
    setRequestError('');
    try {
      await apiRequest(`/platform/subscription-plan-requests/${request.id}`, { method: 'PATCH', body: { status } });
      await loadRequests();
      if (status === 'APPROVED') await onUpdated();
    } catch (reviewError) {
      setRequestError(reviewError instanceof Error ? reviewError.message : 'Impossible de traiter cette demande.');
    } finally {
      setReviewingId('');
    }
  }

  return <section className="platform-subscriptions" id="subscriptions">
    <div className="platform-subscription-heading"><div><span className="platform-section-kicker">TARIFICATION PAR ÉTABLISSEMENT</span><h2>Abonnements scolaires</h2><p>Un abonnement par école, quel que soit le nombre de membres du personnel. Les limites d’effectif sont indicatives.</p></div><div className="subscription-revenue"><small>REVENU MENSUEL RÉCURRENT ESTIMÉ</small><strong>{money.format(monthlyRevenue)}</strong><span>{activeSubscriptions.length} abonnement(s) actif(s) · hors essais et impayés</span></div></div>
    <div className="subscription-plan-grid">{plans.map((plan) => { const price = planSettings.find((setting) => setting.plan === plan.id)?.monthlyFee ?? plan.price; return <article className="subscription-plan-card" key={plan.id}><div><strong>{plan.label}</strong><span>{plan.id === 'CUSTOM' ? 'Sur devis' : `${money.format(price)} / mois`}</span></div><small>{plan.students}</small><p>{plan.features}</p></article>; })}</div>
    <section className="subscription-requests-panel"><div className="subscription-list-heading"><div><strong>Demandes des écoles</strong><small>Les forfaits ne sont appliqués qu’après validation.</small></div><span>{requests.length} en attente</span></div>
      {requestError && <div className="feedback-message error-message" role="alert">{requestError}</div>}
      {!requestError && requests.length === 0 ? <p className="platform-empty">Aucune demande de forfait en attente.</p> : requests.map((request) => <article className="subscription-request-row" key={request.id}>
        <div><strong>{request.school.name}</strong><small>Demande pour {plans.find((plan) => plan.id === request.plan)?.label ?? request.plan} · {new Date(request.requestedAt).toLocaleDateString('fr-FR')}</small></div>
        <div className="subscription-request-actions"><button type="button" className="platform-admin-reset" disabled={Boolean(reviewingId)} onClick={() => void reviewRequest(request, 'REJECTED')}>{reviewingId === request.id ? 'Traitement…' : 'Refuser'}</button><button type="button" className="primary-button" disabled={Boolean(reviewingId)} onClick={() => void reviewRequest(request, 'APPROVED')}>{reviewingId === request.id ? 'Traitement…' : 'Approuver'}</button></div>
      </article>)}
    </section>
    <div className="subscription-list-heading"><div><strong>Forfait par école</strong><small>Les abonnements s’appliquent à l’établissement, jamais à chaque utilisateur.</small></div><span>{schools.length} écoles</span></div>
    {!schools.length ? <p className="platform-empty">Aucun établissement à facturer.</p> : <div className="subscription-school-list">{schools.map((school) => <SubscriptionEditor key={school.id} school={school} schoolIds={schools.map(({ id }) => id)} planSettings={planSettings} onUpdated={onUpdated} />)}</div>}
    <p className="subscription-disclaimer">Simulation indicative en FCFA. Les montants ne sont pas encore encaissés par la plateforme : configurez un moyen de paiement et validez vos coûts avant la commercialisation. Les plafonds d’élèves sont des repères commerciaux et ne sont pas appliqués techniquement.</p>
  </section>;
}

function SubscriptionEditor({ school, schoolIds, planSettings, onUpdated }: { school: SchoolSubscriptionRecord; schoolIds: readonly string[]; planSettings: PlatformPlanSetting[]; onUpdated: () => Promise<void> }) {
  const [plan, setPlan] = useState<SchoolSubscriptionRecord['subscriptionPlan']>(school.subscriptionPlan);
  const [status, setStatus] = useState<SchoolSubscriptionRecord['subscriptionStatus']>(school.subscriptionStatus);
  const [monthlyFee, setMonthlyFee] = useState(String(school.monthlyFee));
  const [renewalAt, setRenewalAt] = useState(school.subscriptionRenewalAt?.slice(0, 10) ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const selectedPlan = useMemo(() => plans.find((item) => item.id === plan) ?? plans[0], [plan]);

  function changePlan(value: SchoolSubscriptionRecord['subscriptionPlan']) {
    setPlan(value);
    const preset = planSettings.find((item) => item.plan === value)?.monthlyFee ?? plans.find((item) => item.id === value)?.price;
    if (value === 'CUSTOM') setMonthlyFee('0');
    else if (preset && value !== 'ENTERPRISE') setMonthlyFee(String(preset));
    else if (value === 'ENTERPRISE') setMonthlyFee('100000');
    setSaved(false);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      await apiRequest(`/platform/schools/${school.id}/subscription`, {
        method: 'PATCH',
        body: { subscriptionPlan: plan, subscriptionStatus: status, monthlyFee: Number(monthlyFee), subscriptionRenewalAt: renewalAt || null },
      });
      setSaved(true);
      await onUpdated();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Impossible d’enregistrer cet abonnement.');
    } finally { setSaving(false); }
  }

  return <form className="subscription-school-row" onSubmit={(event) => void save(event)}>
    <div className="subscription-school-identity"><span className="platform-school-symbol" style={getSchoolColorStyle(school.id, schoolIds)} aria-hidden="true">{school.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toLocaleUpperCase('fr')}</span><span><strong>{school.name}</strong><small>{selectedPlan.label} · abonnement par école</small></span></div>
    <label className="subscription-field">Forfait<select value={plan} onChange={(event) => changePlan(event.target.value as SchoolSubscriptionRecord['subscriptionPlan'])}>{plans.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
    <label className="subscription-field">Statut<select value={status} onChange={(event) => { setStatus(event.target.value as SchoolSubscriptionRecord['subscriptionStatus']); setSaved(false); }}>{statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <label className="subscription-field">Tarif mensuel (FCFA)<input type="number" min="0" max="1000000" step="1000" required value={monthlyFee} onChange={(event) => { setMonthlyFee(event.target.value); setSaved(false); }} /></label>
    <label className="subscription-field">Prochain renouvellement<input type="date" value={renewalAt} onChange={(event) => { setRenewalAt(event.target.value); setSaved(false); }} /></label>
    <div className="subscription-save-cell">{error && <small className="subscription-error" role="alert">{error}</small>}{saved && <small className="subscription-saved" role="status">Enregistré</small>}<button className="platform-admin-reset" disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button></div>
  </form>;
}
