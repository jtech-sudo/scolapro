import { FormEvent, useEffect, useState } from 'react';
import { apiRequest, clearParentAuthToken, getParentAuthToken, ParentPortalLoginSession, ParentPortalSession, setParentAuthToken } from './api';

export function ParentPortalAccessPage() {
  const [schoolSlug, setSchoolSlug] = useState(() => new URLSearchParams(window.location.search).get('school') ?? '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [session, setSession] = useState<ParentPortalSession | null>(null);
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = getParentAuthToken();
    if (!token) {
      setChecking(false);
      return;
    }
    void apiRequest<ParentPortalSession>('/parent-portal/parent/me')
      .then(setSession)
      .catch(() => { clearParentAuthToken(); setSession(null); })
      .finally(() => setChecking(false));
  }, []);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await apiRequest<ParentPortalLoginSession>('/parent-portal/parent/login', {
        method: 'POST',
        body: { schoolSlug, email, password },
      });
      setParentAuthToken(result.accessToken);
      setSession({ user: result.user, school: result.school, guardian: result.guardian, portalEnabled: result.portalEnabled });
      setPassword('');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Impossible d’ouvrir cette session parent.');
    } finally {
      setLoading(false);
    }
  }

  function signOut() {
    clearParentAuthToken();
    setSession(null);
    setPassword('');
  }

  return <main className="auth-shell auth-login-shell school-login-shell"><div className="auth-layout auth-login-layout"><section className="auth-card auth-login-card">
    <div className="auth-card-brand auth-login-brand"><img src="/scolapro-icon.svg" alt="" /><span><strong>ScolaPro</strong><small>ESPACE FAMILLES</small></span></div>
    {checking ? <p className="auth-description">Vérification de votre session…</p> : session ? <>
      <p className="eyebrow">SESSION PARENT</p>
      <h1>Bonjour {session.guardian.firstName}</h1>
      <p className="auth-description">{session.school.name} · {session.guardian.childCount} enfant(s) rattaché(s)</p>
      <div className="admin-warning" role="note"><strong>Accès familial limité</strong><span>Votre session est authentifiée. La consultation des données scolaires reste désactivée tant que le portail n’est pas officiellement ouvert par l’établissement.</span></div>
      <button type="button" className="secondary-button" onClick={signOut}>Se déconnecter</button>
    </> : <>
      <p className="eyebrow">ESPACE FAMILLES</p>
      <h1>Connexion parent</h1>
      <p className="auth-description">Utilisez les identifiants fournis par l’établissement.</p>
      <form onSubmit={(event) => void signIn(event)}>
        <label className="field-label">Identifiant de l’école<input required minLength={2} maxLength={100} autoCapitalize="none" autoComplete="organization" value={schoolSlug} onChange={(event) => setSchoolSlug(event.target.value)} /></label>
        <label className="field-label">Adresse courriel<input required type="email" maxLength={160} autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <label className="field-label">Mot de passe<input required type="password" minLength={1} maxLength={128} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        {error && <div className="feedback-message error-message" role="alert">{error}</div>}
        <button className="primary-button auth-submit" disabled={loading}>{loading ? 'Connexion…' : 'Se connecter'}</button>
      </form>
    </>}
    <a className="platform-back-link" href="/">Retour à l’espace école</a>
  </section></div></main>;
}
