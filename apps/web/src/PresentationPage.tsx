import { modules } from './schoolModules';

const highlights = [
  {
    title: 'Une vision complète',
    description: 'Centralisez les élèves, les classes, les enseignants, les paiements et les familles dans un seul espace.',
  },
  {
    title: 'Des données protégées',
    description: 'Chaque établissement dispose de son espace sécurisé et de ses propres données.',
  },
  {
    title: 'Un outil simple à utiliser',
    description: 'Une interface claire, accessible sur ordinateur, tablette et téléphone.',
  },
];

export function PresentationPage() {
  return (
    <main className="presentation-page">
      <header className="presentation-header">
        <div className="presentation-appbar">
          <a className="presentation-brand" href="/">
            <img src="/scolapro-icon.svg" alt="" />
            <span>ScolaPro</span>
          </a>

          <nav className="presentation-nav" aria-label="Navigation principale">
            <a href="#accueil">Accueil</a>
            <a href="#modules">Modules</a>
            <a href="#fonctionnalites">Fonctionnalités</a>
            <a href="#contact">Contact</a>
          </nav>

          <div className="presentation-actions-header">
            <a className="presentation-login-link" href="/">Se connecter</a>
            <a className="primary-button presentation-button presentation-button-small" href="/">Essai</a>
          </div>
        </div>
      </header>

      <section className="presentation-hero" id="accueil">
        <div className="presentation-hero-seal" aria-hidden="true">
          <img src="/scolapro-icon.svg" alt="" />
          <strong>ScolaPro</strong>
        </div>
        <div className="presentation-hero-copy">
          <p className="eyebrow">PLATEFORME DE GESTION SCOLAIRE</p>
          <h1>La gestion de votre établissement, simplement.</h1>
          <p className="presentation-lead">
            ScolaPro aide les écoles à organiser leur administration, leur pédagogie et leur relation avec les familles dans une plateforme unique.
          </p>
          <div className="presentation-actions">
            <a className="primary-button presentation-button" href="/">Accéder à mon espace</a>
            <a className="presentation-secondary-link" href="#modules">Découvrir les modules</a>
          </div>
        </div>
        <div className="presentation-hero-card">
          <span className="presentation-card-label">VOTRE ÉTABLISSEMENT</span>
          <strong>Tout ce qu’il vous faut au même endroit</strong>
          <div className="presentation-mini-grid">
            {['Élèves', 'Classes', 'Présences', 'Paiements'].map((item, index) => (
              <span key={item}><b>{String(index + 1).padStart(2, '0')}</b>{item}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="presentation-highlights" id="fonctionnalites">
        {highlights.map((highlight, index) => (
          <article className="presentation-highlight" key={highlight.title}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <h2>{highlight.title}</h2>
            <p>{highlight.description}</p>
          </article>
        ))}
      </section>

      <aside className="presentation-endbar" aria-label="Raccourcis d’accès">
        <div className="presentation-endbar-copy">
          <span>Plateforme complète</span>
          <strong>Administration, pédagogie, finances, suivi famille</strong>
        </div>
        <div className="presentation-endbar-links">
          <a href="#modules">Voir les modules</a>
          <a href="/">Accéder à l’espace</a>
        </div>
      </aside>

      <section className="presentation-modules" id="modules">
        <div className="presentation-section-heading">
          <p className="eyebrow">UNE PLATEFORME MODULAIRE</p>
          <h2>Les outils essentiels de votre école</h2>
        </div>
        <div className="presentation-module-grid">
          {modules.slice(0, 8).map((module) => (
            <article className="presentation-module-card" key={module.id}>
              <span>{module.number}</span>
              <h3>{module.title}</h3>
              <p>{module.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="presentation-cta" id="contact">
        <p className="eyebrow">PRÊT À COMMENCER ?</p>
        <h2>Donnez à votre équipe un espace de travail plus clair.</h2>
        <a className="primary-button presentation-button" href="/">Se connecter à ScolaPro</a>
      </section>

      <footer className="presentation-footer">ScolaPro · Une solution pour les établissements scolaires.</footer>
    </main>
  );
}
