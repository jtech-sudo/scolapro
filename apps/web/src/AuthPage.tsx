import { FormEvent, useEffect, useState } from 'react';
import { apiRequest, AuthSession, setAuthToken } from './api';

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

export function AuthPage({ onAuthenticated }: { onAuthenticated: (session: AuthSession) => void }) {
  const [schoolSlug, setSchoolSlug] = useState(() => new URLSearchParams(window.location.search).get('school') ?? '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(() => window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone));

  useEffect(() => {
    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  async function handleInstall() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === 'accepted') setIsStandalone(true);
    setInstallPrompt(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const session = await apiRequest<AuthSession>('/auth/login', { method: 'POST', body: { schoolSlug, email, password } });
      setAuthToken(session.accessToken);
      if (new URLSearchParams(window.location.search).has('school')) {
        window.history.replaceState(null, '', window.location.pathname);
      }
      onAuthenticated(session);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Impossible d’ouvrir cette session.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-shell auth-login-shell school-login-shell">
      <div className="auth-layout auth-login-layout">
        <aside className="auth-login-showcase" aria-label="Présentation de ScolaPro">
          <div className="auth-login-showcase-brand">
            <img src="/scolapro-icon.svg" alt="" />
            <span><strong>ScolaPro</strong><small>GESTION SCOLAIRE</small></span>
          </div>
          <div className="auth-login-showcase-copy">
            <p className="auth-login-kicker">L’ÉCOLE, BIEN ORGANISÉE</p>
            <h2>Tout votre établissement.<br />Un seul espace.</h2>
            <p>Les outils essentiels de votre école, réunis dans une plateforme simple et claire.</p>
          </div>
          <div className="auth-login-preview" aria-hidden="true">
            <div className="auth-login-preview-top">
              <span><i /><i /><i /></span>
              <small>VUE D’ENSEMBLE</small>
              <b>•••</b>
            </div>
            <div className="auth-login-preview-title">Bonjour, équipe scolaire <span>✦</span></div>
            <div className="auth-login-preview-stats">
              <div>
                <small>Élèves</small>
                <strong>1 248</strong>
                <i className="auth-preview-bars"><b /><b /><b /><b /><b /><b /><b /></i>
              </div>
              <div>
                <small>Présence aujourd’hui</small>
                <strong>96<span>%</span></strong>
                <i className="auth-preview-progress"><b /></i>
              </div>
            </div>
            <div className="auth-login-preview-calendar">
              <span><b>AUJOURD’HUI</b><strong>Suivi de la journée</strong></span>
              <i><b /><b /><b /><b /></i>
            </div>
          </div>
          <p className="auth-login-showcase-footer"><span aria-hidden="true">✦</span> Une gestion plus sereine, au quotidien.</p>
        </aside>
        <section className="auth-card auth-login-card">
          <div className="auth-login-mobile-brand">
            <img src="/scolapro-icon.svg" alt="" />
            <strong>ScolaPro</strong>
          </div>
          <p className="eyebrow">ESPACE ÉCOLE</p>
          <h1>Bon retour parmi nous</h1>
          <p className="auth-description">Connectez-vous à votre espace scolaire.</p>
          <form onSubmit={(event) => void handleSubmit(event)}>
            <label className="field-label">
              Identifiant de l’école
              <input required minLength={2} maxLength={100} autoCapitalize="none" autoComplete="organization" value={schoolSlug} onChange={(event) => setSchoolSlug(event.target.value)} placeholder="identifiant-fourni-par-l’école" />
              <small className="field-hint">L’identifiant est communiqué par l’administration de la plateforme.</small>
            </label>
            <label className="field-label">
              Adresse courriel
              <input required type="email" maxLength={160} autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            <label className="field-label">
              Mot de passe
              <input required type="password" minLength={1} maxLength={128} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </label>
            {error && <div className="feedback-message error-message" role="alert">{error}</div>}
            <button className="primary-button auth-submit" disabled={loading}>
              {loading ? 'Connexion…' : 'Se connecter'}
              <span aria-hidden="true">→</span>
            </button>
          </form>
          <nav className="auth-login-links" aria-label="Autres espaces ScolaPro">
            <a href="/parents">Connexion des familles</a>
            <a href="/platform">Administration de la plateforme</a>
          </nav>
          <a className="auth-login-discover" href="/presentation">Découvrir ScolaPro <span aria-hidden="true">↗</span></a>
          {!isStandalone && installPrompt && (
            <button type="button" className="pwa-install-button" onClick={() => void handleInstall()}>
              <span aria-hidden="true">↓</span> Installer l’application
            </button>
          )}
        </section>
      </div>
    </main>
  );
}
