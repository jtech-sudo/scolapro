import { FormEvent, useEffect, useMemo, useState } from 'react';
import { apiRequest, clearPlatformToken, getPlatformToken, setPlatformToken, AdminUser } from './api';
import { PlatformSchoolManagement } from './PlatformSchoolManagement';
import { PlatformPayments } from './PlatformPayments';
import { PlatformSubscriptions } from './PlatformSubscriptions';
import { PlatformSettings } from './PlatformSettings';
import { PlatformUsers } from './PlatformUsers';
import { getSchoolColorStyle } from './schoolColors';
import { PlatformPlanSetting } from './api';

type PlatformSession = { accessToken: string; user: { id: string; fullName: string; email: string | null; role: 'PLATFORM_ADMIN' } };
type PlatformUser = PlatformSession['user'];
type PlatformSchool = { id: string; name: string; slug: string; isActive: boolean; createdAt: string; subscriptionPlan: 'STARTER' | 'PRO' | 'PREMIUM' | 'ENTERPRISE' | 'CUSTOM'; subscriptionStatus: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED' | 'CANCELED'; monthlyFee: number; subscriptionStartedAt: string | null; subscriptionRenewalAt: string | null; owner: { id: string; fullName: string; email: string | null } | null; _count: { memberships: number } };

export function PlatformPage() {
  const [needsBootstrap, setNeedsBootstrap] = useState(false);
  const [user, setUser] = useState<PlatformUser | null>(null);
  const [schools, setSchools] = useState<PlatformSchool[]>([]);
  const [planSettings, setPlanSettings] = useState<PlatformPlanSetting[]>([]);
  const [schoolName, setSchoolName] = useState('');
  const [adminFullName, setAdminFullName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [createdSchoolSlug, setCreatedSchoolSlug] = useState('');
  const [schoolSearch, setSchoolSearch] = useState('');
  const [schoolStatusFilter, setSchoolStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [activeSection, setActiveSection] = useState('overview');
  const [resetSchool, setResetSchool] = useState<PlatformSchool | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [confirmResetPassword, setConfirmResetPassword] = useState('');
  const [resetSaving, setResetSaving] = useState(false);
  const [passwordResetNotice, setPasswordResetNotice] = useState('');
  const [manageSchool, setManageSchool] = useState<PlatformSchool | null>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [bootstrapKey, setBootstrapKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function refreshSchools() {
    setSchools(await apiRequest<PlatformSchool[]>('/platform/schools'));
  }

  async function refreshPlanSettings() {
    setPlanSettings(await apiRequest<PlatformPlanSetting[]>('/platform/subscription-plans'));
  }

  useEffect(() => {
    let mounted = true;
    void apiRequest<{ needsBootstrap: boolean }>('/platform/auth/status')
      .then((status) => { if (mounted) setNeedsBootstrap(status.needsBootstrap); })
      .then(async () => {
        if (!getPlatformToken()) return;
        try {
          const result = await apiRequest<{ user: PlatformUser }>('/platform/auth/me');
          if (mounted) { setUser(result.user); await refreshSchools(); }
        } catch { clearPlatformToken(); }
      })
      .catch((requestError) => { if (mounted) setError(requestError instanceof Error ? requestError.message : 'API indisponible.'); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!user) return;
    const sectionIds = new Set(['overview', 'create-school', 'schools', 'subscriptions', 'users', 'payments', 'settings']);
    const updateActiveSection = () => {
      const sectionId = window.location.hash.slice(1);
      if (sectionIds.has(sectionId)) setActiveSection(sectionId);
    };
    updateActiveSection();
    window.addEventListener('hashchange', updateActiveSection);
    return () => {
      window.removeEventListener('hashchange', updateActiveSection);
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    void refreshPlanSettings().catch((requestError) => setError(requestError instanceof Error ? requestError.message : 'Impossible de charger les tarifs.'));
  }, [user]);

  const filteredSchools = useMemo(() => schools.filter((school) => {
    const matchesSearch = `${school.name} ${school.slug}`.toLocaleLowerCase('fr').includes(schoolSearch.trim().toLocaleLowerCase('fr'));
    const matchesStatus = schoolStatusFilter === 'all' || school.isActive === (schoolStatusFilter === 'active');
    return matchesSearch && matchesStatus;
  }).sort((a, b) => a.name.localeCompare(b.name, 'fr')), [schools, schoolSearch, schoolStatusFilter]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const session = needsBootstrap
        ? await apiRequest<PlatformSession>('/platform/auth/bootstrap', { method: 'POST', body: { bootstrapKey, fullName, email, password } })
        : await apiRequest<PlatformSession>('/platform/auth/login', { method: 'POST', body: { email, password } });
      setPlatformToken(session.accessToken);
      setUser(session.user);
      if (needsBootstrap) setNeedsBootstrap(false);
      await refreshSchools();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Connexion impossible.');
    } finally { setSaving(false); }
  }

  async function changeSchoolStatus(school: PlatformSchool) {
    const nextStatus = !school.isActive;
    try {
      await apiRequest(`/platform/schools/${school.id}/status`, { method: 'PATCH', body: { isActive: nextStatus } });
      await refreshSchools();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Modification impossible.');
    }
  }

  async function resetSchoolAdminPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!resetSchool?.owner || resetPassword !== confirmResetPassword) {
      setError('Confirmez le même mot de passe dans les deux champs.');
      return;
    }
    setResetSaving(true);
    setError('');
    try {
      await apiRequest(`/platform/schools/${resetSchool.id}/administration/users/${resetSchool.owner.id}/password`, {
        method: 'POST',
        body: { password: resetPassword },
      });
      setPasswordResetNotice(`Le mot de passe du compte administrateur de ${resetSchool.name} a été réinitialisé.`);
      setResetSchool(null);
      setResetPassword('');
      setConfirmResetPassword('');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Réinitialisation impossible.');
    } finally { setResetSaving(false); }
  }

  async function createSchool(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setCreatedSchoolSlug('');
    try {
      const school = await apiRequest<PlatformSchool>('/platform/schools', {
        method: 'POST',
        body: { schoolName, adminFullName, adminEmail, adminPassword },
      });
      setCreatedSchoolSlug(school.slug);
      setSchoolName('');
      setAdminFullName('');
      setAdminEmail('');
      setAdminPassword('');
      await refreshSchools();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Création de l’établissement impossible.');
    } finally { setSaving(false); }
  }

  if (loading) return <main className="auth-shell"><div className="auth-loading">Chargement de la console plateforme…</div></main>;

  if (!user) return (
    <main className="auth-shell platform-shell platform-login-shell">
      <section className="platform-login-card" aria-labelledby="platform-login-title">
        <div className="platform-login-brand">
          <img src="/scolapro-icon.svg" alt="" />
          <strong>ScolaPro</strong>
        </div>
        <p className="platform-login-eyebrow">ADMINISTRATION DE LA PLATEFORME</p>
        <h1 id="platform-login-title">{needsBootstrap ? 'Créer le compte administrateur' : 'Connexion'}</h1>
        <p className="platform-login-description">
          {needsBootstrap ? 'Initialisez votre espace d’administration sécurisé.' : 'Connectez-vous à la console d’administration.'}
        </p>
        <form onSubmit={(event) => void handleSubmit(event)}>
          {needsBootstrap && <>
            <label className="field-label">Clé de configuration initiale<input required minLength={32} autoComplete="off" value={bootstrapKey} onChange={(event) => setBootstrapKey(event.target.value)} /></label>
            <label className="field-label">Nom complet<input required minLength={2} maxLength={100} autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} /></label>
          </>}
          <label className="field-label">Adresse courriel<input required type="email" maxLength={160} autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label className="field-label">Mot de passe<input required type="password" minLength={needsBootstrap ? 12 : 1} maxLength={128} autoComplete={needsBootstrap ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} />{needsBootstrap && <small className="field-hint">12 caractères minimum, avec majuscule, minuscule et chiffre.</small>}</label>
          {error && <div className="feedback-message error-message" role="alert">{error}</div>}
          <button className="primary-button platform-login-submit" disabled={saving}>{saving ? 'Veuillez patienter…' : needsBootstrap ? 'Créer le compte plateforme' : 'Se connecter'}</button>
        </form>
        <a className="platform-back-link" href="/">Retour à la connexion des écoles</a>
      </section>
    </main>
  );

  const activeCount = schools.filter((school) => school.isActive).length;
  const activeSectionLabel = {
    overview: 'Dashboard',
    'create-school': 'Ajouter une école',
    schools: 'Établissements',
    subscriptions: 'Abonnements',
    users: 'Utilisateurs',
    payments: 'Paiements',
    settings: 'Paramètres',
  }[activeSection] ?? 'Administration';
  return (
    <main className="platform-dashboard">
      <aside className="platform-sidebar">
        <a className="platform-brand" href="#overview" aria-label="ScolaPro — accueil de l’administration">
          <img src="/scolapro-icon.svg" alt="" />
          <strong>ScolaPro</strong>
        </a>
        <div className="platform-sidebar-label">ESPACE ADMIN SCOLAPRO</div>
        <nav className="platform-nav" aria-label="Navigation de l’administration">
          <a className={activeSection === 'overview' ? 'active' : ''} href="#overview" onClick={() => setActiveSection('overview')} aria-current={activeSection === 'overview' ? 'location' : undefined} aria-label="Dashboard"><span aria-hidden="true">⌂</span><span className="platform-nav-label" data-mobile-label="Dashboard">Dashboard</span></a>
          <a className={activeSection === 'create-school' ? 'active' : ''} href="#create-school" onClick={() => setActiveSection('create-school')} aria-current={activeSection === 'create-school' ? 'location' : undefined} aria-label="Ajouter une école"><span aria-hidden="true">＋</span><span className="platform-nav-label" data-mobile-label="Ajouter">Ajouter une école</span></a>
          <a className={activeSection === 'schools' ? 'active' : ''} href="#schools" onClick={() => setActiveSection('schools')} aria-current={activeSection === 'schools' ? 'location' : undefined} aria-label={`Écoles, ${schools.length}`}><span aria-hidden="true">▦</span><span className="platform-nav-label" data-mobile-label="Écoles">Écoles</span><b>{schools.length}</b></a>
          <a className={activeSection === 'subscriptions' ? 'active' : ''} href="#subscriptions" onClick={() => setActiveSection('subscriptions')} aria-current={activeSection === 'subscriptions' ? 'location' : undefined} aria-label="Abonnements"><span aria-hidden="true">◉</span><span className="platform-nav-label" data-mobile-label="Abonn.">Abonnements</span></a>
          <a className={activeSection === 'users' ? 'active' : ''} href="#users" onClick={() => setActiveSection('users')} aria-current={activeSection === 'users' ? 'location' : undefined} aria-label="Utilisateurs"><span aria-hidden="true">♙</span><span className="platform-nav-label" data-mobile-label="Utilis.">Utilisateurs</span></a>
          <a className={activeSection === 'payments' ? 'active' : ''} href="#payments" onClick={() => setActiveSection('payments')} aria-current={activeSection === 'payments' ? 'location' : undefined} aria-label="Paiements"><span aria-hidden="true">¤</span><span className="platform-nav-label" data-mobile-label="Paiem.">Paiements</span></a>
          <a className={activeSection === 'settings' ? 'active' : ''} href="#settings" onClick={() => setActiveSection('settings')} aria-current={activeSection === 'settings' ? 'location' : undefined} aria-label="Paramètres"><span aria-hidden="true">⚙</span><span className="platform-nav-label" data-mobile-label="Réglages">Paramètres</span></a>
        </nav>
        <div className="platform-sidebar-footer"><span className="platform-security-icon" aria-hidden="true">✓</span><span><strong>Console sécurisée</strong><small>Accès réservé à l’administration</small></span></div>
      </aside>
      <div className="platform-main">
        <header className="platform-header">
          <div className="platform-breadcrumb"><span>Administration</span><i>/</i><strong>{activeSectionLabel}</strong></div>
          <div className="platform-header-actions"><a className="platform-home-link" href="/">Espace école <span aria-hidden="true">↗</span></a><span className="platform-user-avatar" aria-hidden="true">{user.fullName.trim().split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toLocaleUpperCase('fr')}</span><span className="platform-user-name">{user.fullName}</span><button className="platform-logout" onClick={() => { clearPlatformToken(); setUser(null); setSchools([]); }}>Déconnexion</button></div>
        </header>
        <section className="platform-content">
        <section className="platform-overview" id="overview" hidden={activeSection !== 'overview'}>
        <section className="platform-page-intro">
          <div><p className="eyebrow">VOTRE PLATEFORME</p><h1>Administration des établissements ScolaPro</h1><p className="platform-intro">Créez vos établissements, suivez leur activité et gérez leurs abonnements depuis un espace central, sans accéder aux dossiers scolaires. Chaque abonnement est facturé par établissement et inclut les comptes de son personnel.</p></div>
          <a className="platform-primary-link" href="#create-school"><span aria-hidden="true">＋</span> Ajouter une école</a>
        </section>
        <div className="platform-stats"><article><span className="platform-stat-icon total" aria-hidden="true">▦</span><span className="platform-stat-label">Établissements</span><strong>{schools.length}</strong><small>Inscrits sur la plateforme</small></article><article><span className="platform-stat-icon active" aria-hidden="true">✓</span><span className="platform-stat-label">Actifs</span><strong>{activeCount}</strong><small>Accès autorisé</small></article><article><span className="platform-stat-icon suspended" aria-hidden="true">Ⅱ</span><span className="platform-stat-label">Suspendus</span><strong>{schools.length - activeCount}</strong><small>Accès temporairement bloqué</small></article></div>
        </section>
        {error && <div className="feedback-message error-message" role="alert">{error}</div>}
        {passwordResetNotice && <div className="feedback-message success-message" role="status">{passwordResetNotice}</div>}
        {createdSchoolSlug && <div className="feedback-message success-message platform-created-feedback" role="status">Établissement créé. Identifiant : <strong>{createdSchoolSlug}</strong><a href={`/?school=${encodeURIComponent(createdSchoolSlug)}`} target="_blank" rel="noreferrer">Ouvrir la connexion de l’école ↗</a><small>Transmettez l’identifiant au responsable par un canal sécurisé.</small></div>}
        <div className="platform-view" hidden={activeSection !== 'create-school'}><section className="platform-table-card platform-create-card" id="create-school"><div className="platform-table-heading"><div><span className="platform-section-kicker">NOUVEL ESPACE</span><h2>Ajouter un établissement</h2><p>Créez l’espace école et son premier compte administrateur.</p></div><span className="platform-section-number">01</span></div>
          <form className="platform-create-form" onSubmit={(event) => void createSchool(event)}>
            <label className="field-label">Nom de l’établissement<input required minLength={2} maxLength={120} value={schoolName} onChange={(event) => setSchoolName(event.target.value)} placeholder="Ex. École Les Palmiers" /></label>
            <label className="field-label">Nom complet du responsable<input required minLength={2} maxLength={100} autoComplete="name" value={adminFullName} onChange={(event) => setAdminFullName(event.target.value)} /></label>
            <label className="field-label">Courriel du responsable<input required type="email" maxLength={160} autoComplete="email" value={adminEmail} onChange={(event) => setAdminEmail(event.target.value)} /></label>
            <label className="field-label">Mot de passe initial<input required type="password" minLength={12} maxLength={128} autoComplete="new-password" value={adminPassword} onChange={(event) => setAdminPassword(event.target.value)} /><small className="field-hint">12 caractères minimum, avec majuscule, minuscule et chiffre.</small></label>
            <button className="primary-button platform-create-button" disabled={saving}>{saving ? 'Création…' : 'Créer l’établissement'}</button>
          </form>
        </section></div>
        <div className="platform-view" hidden={activeSection !== 'schools'}><section className="platform-table-card platform-schools-card" id="schools"><div className="platform-table-heading platform-schools-heading"><div><span className="platform-section-kicker">RÉPERTOIRE</span><h2>Établissements</h2><p>Recherchez une école et gérez son état d’accès.</p></div><button className="platform-refresh" onClick={() => void refreshSchools()}><span aria-hidden="true">↻</span> Actualiser</button></div>
          <div className="platform-table-tools"><label className="platform-search"><span aria-hidden="true">⌕</span><input type="search" value={schoolSearch} onChange={(event) => setSchoolSearch(event.target.value)} placeholder="Rechercher une école…" aria-label="Rechercher une école" /></label><div className="platform-filter-tabs" role="group" aria-label="Filtrer les établissements par statut">{([['all', 'Toutes'], ['active', 'Actives'], ['suspended', 'Suspendues']] as const).map(([id, label]) => <button key={id} type="button" className={schoolStatusFilter === id ? 'selected' : ''} aria-pressed={schoolStatusFilter === id} onClick={() => setSchoolStatusFilter(id)}>{label}<span>{id === 'all' ? schools.length : id === 'active' ? activeCount : schools.length - activeCount}</span></button>)}</div></div>
          {filteredSchools.length ? <div className="platform-table-wrap"><table className="platform-table"><thead><tr><th>Établissement</th><th>Identifiant</th><th>Comptes (non facturés)</th><th>Statut</th><th>Créé le</th><th>Accès</th></tr></thead><tbody>{filteredSchools.map((school) => <tr key={school.id}><td><span className="platform-school-symbol" style={getSchoolColorStyle(school.id, schools.map(({ id }) => id))} aria-hidden="true">{school.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toLocaleUpperCase('fr')}</span><a className={`platform-school-link ${school.isActive ? '' : 'disabled'}`} href={school.isActive ? `/?school=${encodeURIComponent(school.slug)}` : undefined} target={school.isActive ? '_blank' : undefined} rel={school.isActive ? 'noreferrer' : undefined} aria-disabled={!school.isActive} title={school.isActive ? `Ouvrir la connexion de ${school.name}` : 'École suspendue : accès indisponible'}>{school.name}<span aria-hidden="true">↗</span></a></td><td><a className={`platform-school-slug ${school.isActive ? '' : 'disabled'}`} href={school.isActive ? `/?school=${encodeURIComponent(school.slug)}` : undefined} target={school.isActive ? '_blank' : undefined} rel={school.isActive ? 'noreferrer' : undefined} aria-disabled={!school.isActive} title={school.isActive ? 'Ouvrir la connexion avec cet identifiant' : 'École suspendue : accès indisponible'}><code>{school.slug}</code></a></td><td>{school._count.memberships}</td><td><span className={`platform-status ${school.isActive ? 'active' : 'suspended'}`}><i />{school.isActive ? 'Actif' : 'Suspendu'}</span></td><td>{new Intl.DateTimeFormat('fr-FR').format(new Date(school.createdAt))}</td><td><div className="platform-school-actions">{school.isActive && <a className="platform-open-school" href={`/?school=${encodeURIComponent(school.slug)}`} target="_blank" rel="noreferrer">Ouvrir <span aria-hidden="true">↗</span></a>}<button className={`platform-status-button ${school.isActive ? 'suspend' : 'activate'}`} onClick={() => void changeSchoolStatus(school)}>{school.isActive ? 'Suspendre' : 'Réactiver'}</button></div></td></tr>)}</tbody></table></div> : <p className="platform-empty">{schools.length ? 'Aucun établissement ne correspond à ces critères.' : 'Aucun établissement inscrit.'}</p>}
        </section>
        </div>
        <div className="platform-view" hidden={activeSection !== 'subscriptions'}><PlatformSubscriptions schools={schools} planSettings={planSettings} onUpdated={refreshSchools} /></div>
        <div className="platform-admin-pages" hidden={activeSection !== 'users'}>
          <PlatformUsers schools={schools.map(({ id, name }) => ({ id, name }))} />
          <section className="platform-table-card platform-admins-card"><div className="platform-table-heading"><div><span className="platform-section-kicker">ADMINISTRATION CENTRALISÉE</span><h2>Comptes et paramètres des écoles</h2><p>Le profil, les comptes et les permissions de chaque établissement sont gérés depuis la plateforme.</p></div></div><div className="platform-admin-list">{schools.map((school) => <article className="platform-admin-row" key={school.id}><span className="platform-school-symbol" style={getSchoolColorStyle(school.id, schools.map(({ id }) => id))} aria-hidden="true">{school.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toLocaleUpperCase('fr')}</span><span className="platform-admin-copy"><strong>{school.owner?.fullName ?? 'Responsable non renseigné'}</strong><small>{school.name} · {school.owner?.email ?? 'Aucun courriel'}</small></span><button type="button" className="platform-admin-reset" onClick={() => setManageSchool(school)}>Gérer l’école</button>{school.owner && <button type="button" className="platform-admin-reset" onClick={() => { setResetSchool(school); setResetPassword(''); setConfirmResetPassword(''); setError(''); setPasswordResetNotice(''); }}>Réinitialiser le mot de passe</button>}</article>)}</div></section>
        </div>
        <div className="platform-view" hidden={activeSection !== 'payments'}><PlatformPayments schools={schools.map(({ id, name }) => ({ id, name }))} /></div>
        <div className="platform-view" hidden={activeSection !== 'settings'}><PlatformSettings onUpdated={refreshPlanSettings} /></div>
        {manageSchool && <PlatformSchoolManagement school={manageSchool} onClose={() => setManageSchool(null)} onResetPassword={(school, member) => { setResetSchool({ ...manageSchool, owner: { id: member.id, fullName: member.fullName, email: member.email } }); setResetPassword(''); setConfirmResetPassword(''); setError(''); setPasswordResetNotice(''); }} />}
        {resetSchool?.owner && <div className="school-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !resetSaving) setResetSchool(null); }}><section className="school-modal platform-reset-modal" role="dialog" aria-modal="true" aria-labelledby="platform-reset-title"><button type="button" className="school-modal-close" aria-label="Fermer" disabled={resetSaving} onClick={() => setResetSchool(null)}>×</button><span className="school-modal-mark">⌑</span><p className="eyebrow">RÉCUPÉRATION D’ACCÈS</p><h2 id="platform-reset-title">Réinitialiser le compte école</h2><p><strong>{resetSchool.owner.fullName}</strong> · {resetSchool.name}<br />Un nouveau mot de passe sera défini. Transmettez-le au responsable par un canal sûr.</p><form onSubmit={(event) => void resetSchoolAdminPassword(event)}><label className="field-label">Nouveau mot de passe<input required type="password" minLength={12} maxLength={128} autoComplete="new-password" value={resetPassword} onChange={(event) => setResetPassword(event.target.value)} /><small className="field-hint">12 caractères minimum, avec majuscule, minuscule et chiffre.</small></label><label className="field-label">Confirmer le mot de passe<input required type="password" minLength={12} maxLength={128} autoComplete="new-password" value={confirmResetPassword} onChange={(event) => setConfirmResetPassword(event.target.value)} /></label><div className="school-modal-actions"><button type="button" className="school-modal-cancel" disabled={resetSaving} onClick={() => setResetSchool(null)}>Annuler</button><button type="submit" className="primary-button" disabled={resetSaving || !resetPassword || resetPassword !== confirmResetPassword}>{resetSaving ? 'Enregistrement…' : 'Réinitialiser'}</button></div></form></section></div>}
        <footer className="platform-footer"><span>© {new Date().getFullYear()} NDEV</span><span>Administration centrale · Espaces scolaires isolés</span></footer>
        </section>
      </div>
    </main>
  );
}