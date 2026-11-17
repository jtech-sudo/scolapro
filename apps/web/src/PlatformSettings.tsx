import { useEffect, useState } from 'react';
import { apiRequest, PlatformPlanSetting, SubscriptionPlanKey } from './api';

const labels: Record<SubscriptionPlanKey, string> = {
  STARTER: 'Starter',
  PRO: 'Pro',
  PREMIUM: 'Premium',
  ENTERPRISE: 'Entreprise',
  CUSTOM: 'Sur devis',
};
const planOrder: SubscriptionPlanKey[] = ['STARTER', 'PRO', 'PREMIUM', 'ENTERPRISE', 'CUSTOM'];

export function PlatformSettings({ onUpdated }: { onUpdated: () => Promise<void> }) {
  const [plans, setPlans] = useState<PlatformPlanSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingPlan, setSavingPlan] = useState<SubscriptionPlanKey | null>(null);
  const [savedPlan, setSavedPlan] = useState<SubscriptionPlanKey | null>(null);
  const [error, setError] = useState('');

  async function refresh() {
    const settings = await apiRequest<PlatformPlanSetting[]>('/platform/subscription-plans');
    setPlans(settings.sort((left, right) => planOrder.indexOf(left.plan) - planOrder.indexOf(right.plan)));
  }

  useEffect(() => {
    let mounted = true;
    void refresh()
      .catch((requestError) => { if (mounted) setError(requestError instanceof Error ? requestError.message : 'Impossible de charger les tarifs.'); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  async function save(plan: PlatformPlanSetting) {
    setSavingPlan(plan.plan);
    setSavedPlan(null);
    setError('');
    try {
      await apiRequest(`/platform/subscription-plans/${plan.plan}`, { method: 'PUT', body: { monthlyFee: plan.monthlyFee } });
      setSavedPlan(plan.plan);
      await onUpdated();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : `Impossible d’enregistrer le tarif ${labels[plan.plan]}.`);
    } finally { setSavingPlan(null); }
  }

  return <section className="platform-table-card platform-admin-page" id="settings">
    <div className="platform-table-heading"><div><span className="platform-section-kicker">CONFIGURATION COMMERCIALE</span><h2>Tarifs des forfaits</h2><p>Modifiez les prix mensuels indicatifs affichés dans les abonnements. Les écoles gardent leur tarif actuel jusqu’à modification individuelle.</p></div></div>
    {error && <p className="platform-admin-feedback" role="alert">{error}</p>}
    {loading ? <p className="platform-empty">Chargement des tarifs…</p> : <div className="platform-plan-settings">{plans.map((plan) => <form key={plan.plan} onSubmit={(event) => { event.preventDefault(); void save(plan); }}>
      <label htmlFor={`plan-fee-${plan.plan}`}>{labels[plan.plan]}<small>{plan.plan === 'CUSTOM' ? 'Tarif personnalisé par école' : 'Prix mensuel de référence'}</small></label>
      <div className="platform-plan-setting-input"><input id={`plan-fee-${plan.plan}`} type="number" min="0" max="1000000" step="1000" required value={plan.monthlyFee} onChange={(event) => { const monthlyFee = Number(event.target.value); setPlans((current) => current.map((item) => item.plan === plan.plan ? { ...item, monthlyFee } : item)); setSavedPlan(null); }} /><span>FCFA / mois</span></div>
      <button className="platform-admin-reset" disabled={savingPlan !== null}>{savingPlan === plan.plan ? 'Enregistrement…' : savedPlan === plan.plan ? 'Enregistré' : 'Enregistrer'}</button>
    </form>)}</div>}
  </section>;
}
