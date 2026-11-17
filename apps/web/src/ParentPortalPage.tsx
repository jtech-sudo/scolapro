import { FormEvent, useEffect, useState } from 'react';
import { apiRequest, ParentPortalAccountData, ParentPortalSettings, PortalNotice } from './api';

type Tab = 'settings' | 'accounts' | 'notices';

const settingLabels: Array<[keyof Omit<ParentPortalSettings, 'id' | 'updatedAt'>, string, string]> = [
  ['showGrades', 'Notes', 'Autoriser la consultation des notes saisies.'],
  ['showReportCards', 'Bulletins', 'Autoriser la consultation des bulletins validés.'],
  ['showBilling', 'Situation financière', 'Afficher les factures, paiements et soldes.'],
  ['showAttendance', 'Présences', 'Afficher les absences et retards.'],
  ['allowGuardianMessages', 'Messages aux familles', 'Préparer une messagerie parent-école.'],
  ['emailNotifications', 'Notifications par courriel', 'Prévoir les notifications par courriel.'],
  ['smsNotifications', 'Notifications par SMS', 'Prévoir les notifications par SMS.'],
];

export function ParentPortalPage({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState<Tab>('settings');
  const [settings, setSettings] = useState<ParentPortalSettings | null>(null);
  const [accountData, setAccountData] = useState<ParentPortalAccountData>({ guardians: [], parentUsers: [] });
  const [notices, setNotices] = useState<PortalNotice[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [settingsData, accounts, noticeData] = await Promise.all([
        apiRequest<ParentPortalSettings>('/parent-portal/settings'),
        apiRequest<ParentPortalAccountData>('/parent-portal/accounts'),
        apiRequest<PortalNotice[]>('/parent-portal/notices'),
      ]);
      setSettings(settingsData);
      setAccountData(accounts);
      setNotices(noticeData);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Impossible de charger le portail parents.');
    } finally { setLoading(false); }
  }

  useEffect(() => { void loadData(); }, []);

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settings) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const { id: _id, schoolId: _schoolId, updatedAt: _updatedAt, ...values } = settings;
      const saved = await apiRequest<ParentPortalSettings>('/parent-portal/settings', { method: 'PUT', body: values });
      setSettings(saved);
      setSuccess('Options enregistrées. La session parent reste limitée tant que le portail de consultation n’est pas ouvert.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Impossible d’enregistrer la configuration.');
    } finally { setSaving(false); }
  }

  async function perform(task: () => Promise<unknown>, message: string) {
    setSaving(true);
    setError('');
    setSuccess('');
    try { await task(); setSuccess(message); await loadData(); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Impossible de terminer cette opération.'); }
    finally { setSaving(false); }
  }

  const tabs: Array<[Tab, string]> = [['settings', 'Fonctionnalités'], ['accounts', 'Comptes parents'], ['notices', 'Communications']];
  const portalSummary = [
    { label: 'Responsables actifs', value: String(accountData.guardians.length), detail: 'familles rattachées' },
    { label: 'Comptes parent', value: String(accountData.guardians.filter((guardian) => guardian.portalAccount).length), detail: 'comptes associés' },
    { label: 'Messages préparés', value: String(notices.length), detail: 'annonces et alertes' },
    { label: 'Fonctionnalités actives', value: String(settingLabels.filter(([key]) => Boolean(settings?.[key])).length), detail: 'options disponibles' },
  ];

  return <section className="workspace-page">
    <button className="back-link" onClick={onBack}>← Retour à la vue générale</button>
    <div className="workspace-title-row"><div><p className="eyebrow">COMMUNICATION AVEC LES FAMILLES</p><h1>Portail parents</h1><p>Préparez les accès, contenus consultables et communications aux responsables.</p></div><span className={`student-status ${settings?.enabled ? 'active' : 'archived'}`}>{settings?.enabled ? 'Activé' : 'Désactivé'}</span></div>
    <div className="admin-warning" role="note"><strong>Portail de consultation désactivé</strong><span>La connexion parent est limitée à l’identité familiale. Les données scolaires restent fermées tant que le portail n’est pas ouvert; les notifications réelles ne sont pas envoyées.</span></div>
    <section className="portal-summary-grid" aria-label="Résumé du portail parents">
      {portalSummary.map((entry) => (
        <article className="portal-summary-card" key={entry.label}>
          <span>{entry.label}</span>
          <strong>{entry.value}</strong>
          <small>{entry.detail}</small>
        </article>
      ))}
    </section>
    {error && <div className="feedback-message error-message" role="alert">{error}</div>}
    {success && <div className="feedback-message success-message" role="status">{success}</div>}
    {loading && <p className="inline-hint">Chargement de la configuration…</p>}
    <nav className="organization-tabs" aria-label="Configuration du portail parents">{tabs.map(([id, label]) => <button key={id} className={tab === id ? 'organization-tab active' : 'organization-tab'} onClick={() => setTab(id)}>{label}</button>)}</nav>

    {settings && tab === 'settings' && <form className="form-card portal-settings-form" onSubmit={(event) => void saveSettings(event)}>
      <div className="form-card-heading"><span className="module-number">01</span><div><strong>Contenus proposés aux familles</strong><small>Ces options préparent les futures vues; elles ne donnent pas accès aux données tant que le portail reste désactivé.</small></div></div>
      <label className="portal-master-toggle"><span><strong>Portail activé</strong><small>L’activation reste verrouillée jusqu’à la mise en place des vues de contenu et à leur validation.</small></span><input type="checkbox" checked={settings.enabled} disabled onChange={() => undefined} /></label>
      <div className="portal-options-list">{settingLabels.map(([key, label, description]) => <label className="portal-option" key={key}><span><strong>{label}</strong><small>{description}</small></span><input type="checkbox" checked={Boolean(settings[key])} onChange={(event) => setSettings({ ...settings, [key]: event.target.checked })} /></label>)}</div>
      <button className="primary-button portal-save" disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer les options'}</button>
    </form>}

    {tab === 'accounts' && <AccountsTab data={accountData} saving={saving} onCreate={(values) => perform(() => apiRequest('/parent-portal/accounts/create', { method: 'POST', body: values }), 'Compte parent créé et associé au responsable.')} onLink={(guardianId, userId) => perform(() => apiRequest('/parent-portal/accounts', { method: 'POST', body: { guardianId, userId } }), 'Compte parent préparé et associé au responsable.')} onUnlink={(guardianId) => perform(() => apiRequest(`/parent-portal/accounts/${guardianId}`, { method: 'DELETE' }), 'Association du compte retirée.')} />}
    {tab === 'notices' && <NoticesTab notices={notices} guardians={accountData.guardians} saving={saving} onCreate={(values) => perform(() => apiRequest('/parent-portal/notices', { method: 'POST', body: values }), 'Annonce enregistrée en brouillon.')} onStatus={(id, status) => perform(() => apiRequest(`/parent-portal/notices/${id}`, { method: 'PATCH', body: { status } }), status === 'READY' ? 'Annonce marquée prête. Aucune notification n’a été envoyée.' : status === 'ARCHIVED' ? 'Annonce archivée.' : 'Annonce remise en brouillon.')} />}
  </section>;
}

function AccountsTab({ data, saving, onCreate, onLink, onUnlink }: {
  data: ParentPortalAccountData; saving: boolean; onCreate: (values: { guardianId: string; fullName: string; email: string; password: string }) => Promise<void>; onLink: (guardianId: string, userId: string) => Promise<void>; onUnlink: (guardianId: string) => Promise<void>;
}) {
  const [newGuardianId, setNewGuardianId] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [linkGuardianId, setLinkGuardianId] = useState('');
  const [userId, setUserId] = useState('');
  const availableGuardians = data.guardians.filter((guardian) => !guardian.portalAccount && guardian.students.length > 0);
  const availableUsers = data.parentUsers.filter((user) => user.isActive && !data.guardians.some((guardian) => guardian.portalAccount?.user.id === user.id));
  return <>
    <form className="form-card portal-link-form" onSubmit={(event) => { event.preventDefault(); void onCreate({ guardianId: newGuardianId, fullName, email, password }).then(() => { setFullName(''); setEmail(''); setPassword(''); setNewGuardianId(''); }); }}>
      <div className="form-card-heading"><span className="module-number">01</span><div><strong>Créer un compte parent</strong><small>Choisissez un responsable déjà lié à au moins un élève actif.</small></div></div>
      <div className="form-row"><label className="field-label">Responsable<select required value={newGuardianId} onChange={(event) => setNewGuardianId(event.target.value)}><option value="">Choisir un responsable</option>{availableGuardians.map((guardian) => <option key={guardian.id} value={guardian.id}>{guardian.firstName} {guardian.lastName} · {guardian.students.length} enfant(s)</option>)}</select></label><label className="field-label">Nom du compte<input required minLength={2} maxLength={100} value={fullName} onChange={(event) => setFullName(event.target.value)} /></label></div>
      <div className="form-row"><label className="field-label">Courriel de connexion<input required type="email" maxLength={160} autoComplete="off" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label className="field-label">Mot de passe initial<input required type="password" minLength={12} maxLength={128} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /><small className="field-hint">12 caractères minimum, avec majuscule, minuscule et chiffre. Transmettez-le par un canal sûr.</small></label></div>
      <button className="primary-button" disabled={saving || !availableGuardians.length}>{saving ? 'Enregistrement…' : 'Créer le compte parent'}</button>
      {!availableGuardians.length && <p className="inline-hint">Aucun responsable actif avec élève rattaché ne peut recevoir un compte.</p>}
    </form>
    <div className="form-card portal-link-form"><div className="form-card-heading"><span className="module-number">01</span><div><strong>Associer un compte parent existant</strong><small>Le compte doit avoir le rôle Parent et le responsable doit être lié à au moins un élève actif.</small></div></div>
      <div className="form-row"><label className="field-label">Responsable<select value={linkGuardianId} onChange={(event) => setLinkGuardianId(event.target.value)}><option value="">Choisir un responsable</option>{availableGuardians.map((guardian) => <option key={guardian.id} value={guardian.id}>{guardian.firstName} {guardian.lastName} · {guardian.students.length} enfant(s)</option>)}</select></label><label className="field-label">Compte parent<select value={userId} onChange={(event) => setUserId(event.target.value)}><option value="">Choisir un compte Parent actif</option>{availableUsers.map((user) => <option key={user.id} value={user.id}>{user.fullName} · {user.email ?? user.phone ?? 'sans coordonnées'}</option>)}</select></label></div>
      <button className="primary-button" disabled={saving || !linkGuardianId || !userId} onClick={() => void onLink(linkGuardianId, userId)}>{saving ? 'Enregistrement…' : 'Préparer l’association'}</button>
      {!availableUsers.length && <p className="inline-hint">Aucun compte Parent indépendant à associer. Utilisez le formulaire de création ci-dessus.</p>}
    </div>
    <div className="configured-list"><div className="section-heading"><div><p className="eyebrow">ACCÈS PRÉPARÉS</p><h2>Responsables et comptes</h2></div></div>{data.guardians.length ? <div className="records-list">{data.guardians.map((guardian) => <div className="record-row" key={guardian.id}><span className="profile-badge">{guardian.firstName[0]}{guardian.lastName[0]}</span><div><strong>{guardian.firstName} {guardian.lastName}</strong><small>{guardian.portalAccount ? `${guardian.portalAccount.user.fullName} · ${guardian.portalAccount.user.email ?? 'courriel non renseigné'}` : `${guardian.students.length} enfant(s) · aucun compte associé`}</small></div>{guardian.portalAccount && <button className="table-action danger-action" disabled={saving} onClick={() => void onUnlink(guardian.id)}>Dissocier</button>}</div>)}</div> : <Empty text="Aucun responsable actif. Ajoutez des responsables dans Organisation scolaire." />}</div>
  </>;
}

function NoticesTab({ notices, guardians, saving, onCreate, onStatus }: {
  notices: PortalNotice[]; guardians: ParentPortalAccountData['guardians']; saving: boolean;
  onCreate: (values: { title: string; body: string; guardianId?: string }) => Promise<void>;
  onStatus: (id: string, status: PortalNotice['status']) => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [guardianId, setGuardianId] = useState('');
  return <>
    <form className="form-card portal-notice-form" onSubmit={(event) => { event.preventDefault(); void onCreate({ title, body, ...(guardianId ? { guardianId } : {}) }).then(() => { setTitle(''); setBody(''); setGuardianId(''); }); }}>
      <div className="form-card-heading"><span className="module-number">01</span><div><strong>Préparer une communication</strong><small>Une annonce peut être générale ou destinée à un responsable précis.</small></div></div>
      <label className="field-label">Titre<input required maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} /></label>
      <label className="field-label">Destinataire<select value={guardianId} onChange={(event) => setGuardianId(event.target.value)}><option value="">Toutes les familles (brouillon général)</option>{guardians.map((guardian) => <option key={guardian.id} value={guardian.id}>{guardian.firstName} {guardian.lastName}</option>)}</select></label>
      <label className="field-label">Message<textarea required minLength={3} maxLength={4000} rows={5} value={body} onChange={(event) => setBody(event.target.value)} placeholder="Rédigez votre annonce…" /></label>
      <button className="primary-button" disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer en brouillon'}</button>
    </form>
    <div className="configured-list"><div className="section-heading"><div><p className="eyebrow">FILE DE COMMUNICATIONS</p><h2>{notices.length} annonce(s)</h2></div></div>{notices.length ? <div className="records-list">{notices.map((notice) => <article className="portal-notice-record" key={notice.id}><div className="notice-record-heading"><div><strong>{notice.title}</strong><small>{notice.guardian ? `À ${notice.guardian.firstName} ${notice.guardian.lastName}` : 'Annonce générale'} · {dateLabel(notice.createdAt)}</small></div><span className={`notice-status ${notice.status.toLowerCase()}`}>{notice.status === 'DRAFT' ? 'Brouillon' : notice.status === 'READY' ? 'Prête (non envoyée)' : 'Archivée'}</span></div><p>{notice.body}</p><div className="notice-record-actions">{notice.status === 'DRAFT' && <button className="table-action" disabled={saving} onClick={() => void onStatus(notice.id, 'READY')}>Marquer prête</button>}{notice.status === 'READY' && <button className="table-action" disabled={saving} onClick={() => void onStatus(notice.id, 'DRAFT')}>Remettre en brouillon</button>}{notice.status !== 'ARCHIVED' && <button className="table-action danger-action" disabled={saving} onClick={() => void onStatus(notice.id, 'ARCHIVED')}>Archiver</button>}</div></article>)}</div> : <Empty text="Aucune communication préparée." />}</div>
  </>;
}

function Empty({ text }: { text: string }) { return <div className="list-empty"><strong>Rien à afficher</strong><span>{text}</span></div>; }
function dateLabel(value: string) { return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(value)); }