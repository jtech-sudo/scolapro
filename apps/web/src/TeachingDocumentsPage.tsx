import React, { useMemo, useState } from 'react';

type TeachingResource = {
  id: number;
  title: string;
  subject: string;
  className: string;
  teacher: string;
  type: 'PDF' | 'PowerPoint' | 'Word' | 'Vidéo';
  size: string;
  updated: string;
  status: 'Publié' | 'À revoir' | 'Partagé';
  tags: string[];
  summary: string;
};

type TeacherCard = {
  id: number;
  name: string;
  specialty: string;
  availability: 'Disponible' | 'À la maison' | 'En supervision';
  classes: string[];
  subjects: string[];
  nextSession: string;
};

type PlanningCard = {
  id: number;
  teacher: string;
  subject: string;
  className: string;
  time: string;
  room: string;
  status: 'Confirmé' | 'À valider';
};

const initialResources: TeachingResource[] = [
  {
    id: 1,
    title: 'Les fractions et les opérations',
    subject: 'Mathématiques',
    className: '6e A',
    teacher: 'M. Ibrahim A.',
    type: 'PDF',
    size: '2.4 Mo',
    updated: 'Aujourd’hui',
    status: 'Publié',
    tags: ['Cours', '6e'],
    summary: 'Support de cours sur les fractions et les simplifications.',
  },
  {
    id: 2,
    title: 'Présentation de la révolution française',
    subject: 'Histoire',
    className: '3e B',
    teacher: 'Mme Salma D.',
    type: 'PowerPoint',
    size: '8.1 Mo',
    updated: 'Hier',
    status: 'Partagé',
    tags: ['Histoire', '3e'],
    summary: 'Séance de découverte avec repères chronologiques et cartes.',
  },
  {
    id: 3,
    title: 'Fiche de grammaire - Les pronoms',
    subject: 'Français',
    className: '5e C',
    teacher: 'M. Yacine B.',
    type: 'Word',
    size: '1.2 Mo',
    updated: 'Lundi',
    status: 'À revoir',
    tags: ['Exercice', 'Grammaire'],
    summary: 'Exercices guidés et corrigés pour la séance de grammaire.',
  },
  {
    id: 4,
    title: 'Séance de sciences: le système solaire',
    subject: 'Sciences',
    className: '4e A',
    teacher: 'Mme Ndeye S.',
    type: 'Vidéo',
    size: '42.8 Mo',
    updated: 'Mardi',
    status: 'Publié',
    tags: ['Vidéo', 'Sciences'],
    summary: 'Présentation visuelle avec schémas et questions de synthèse.',
  },
];

const initialTeachers: TeacherCard[] = [
  { id: 1, name: 'M. Ibrahim A.', specialty: 'Mathématiques', availability: 'Disponible', classes: ['6e A', '5e C'], subjects: ['Mathématiques'], nextSession: '09:30 - Calcul littéral' },
  { id: 2, name: 'Mme Salma D.', specialty: 'Histoire-Géographie', availability: 'À la maison', classes: ['3e B', '2nde A'], subjects: ['Histoire', 'Géographie'], nextSession: '11:00 - Révolution française' },
  { id: 3, name: 'M. Yacine B.', specialty: 'Français', availability: 'En supervision', classes: ['5e C', '4e A'], subjects: ['Français'], nextSession: '13:15 - Analyse de texte' },
  { id: 4, name: 'Mme Ndeye S.', specialty: 'Sciences', availability: 'Disponible', classes: ['4e A', '3e A'], subjects: ['Sciences'], nextSession: '10:45 - Système solaire' },
];

const initialPlanning: PlanningCard[] = [
  { id: 1, teacher: 'M. Ibrahim A.', subject: 'Mathématiques', className: '6e A', time: '08h30 - 09h20', room: 'Salle 12', status: 'Confirmé' },
  { id: 2, teacher: 'Mme Salma D.', subject: 'Histoire', className: '3e B', time: '10h00 - 10h55', room: 'Amphi 2', status: 'À valider' },
  { id: 3, teacher: 'M. Yacine B.', subject: 'Français', className: '5e C', time: '12h40 - 13h30', room: 'Salle 05', status: 'Confirmé' },
  { id: 4, teacher: 'Mme Ndeye S.', subject: 'Sciences', className: '4e A', time: '14h00 - 14h50', room: 'Laboratoire', status: 'Confirmé' },
];

const classOptions = ['Tout', '6e A', '5e C', '4e A', '3e B'];
const subjectOptions = ['Tout', 'Mathématiques', 'Français', 'Histoire', 'Sciences'];

export function TeachingDocumentsPage({ onBack }: { onBack: () => void }) {
  const [resources, setResources] = useState<TeachingResource[]>(initialResources);
  const [search, setSearch] = useState('');
  const [selectedClass, setSelectedClass] = useState('Tout');
  const [selectedSubject, setSelectedSubject] = useState('Tout');
  const [activeTab, setActiveTab] = useState<'resources' | 'team' | 'planning'>('resources');
  const [form, setForm] = useState({
    title: '',
    subject: 'Mathématiques',
    className: '6e A',
    teacher: 'M. Ibrahim A.',
    type: 'PDF' as TeachingResource['type'],
  });

  const visibleResources = useMemo(() => {
    return resources.filter((resource) => {
      const matchesSearch = resource.title.toLowerCase().includes(search.toLowerCase())
        || resource.teacher.toLowerCase().includes(search.toLowerCase())
        || resource.subject.toLowerCase().includes(search.toLowerCase());
      const matchesClass = selectedClass === 'Tout' || resource.className === selectedClass;
      const matchesSubject = selectedSubject === 'Tout' || resource.subject === selectedSubject;
      return matchesSearch && matchesClass && matchesSubject;
    });
  }, [resources, search, selectedClass, selectedSubject]);

  const teachers = useMemo(() => {
    return initialTeachers.filter((teacher) => {
      const matchesSubject = selectedSubject === 'Tout' || teacher.subjects.includes(selectedSubject);
      const matchesClass = selectedClass === 'Tout' || teacher.classes.includes(selectedClass);
      return matchesSubject && matchesClass;
    });
  }, [selectedClass, selectedSubject]);

  const planning = useMemo(() => {
    return initialPlanning.filter((entry) => {
      const matchesSubject = selectedSubject === 'Tout' || entry.subject === selectedSubject;
      const matchesClass = selectedClass === 'Tout' || entry.className === selectedClass;
      return matchesSubject && matchesClass;
    });
  }, [selectedClass, selectedSubject]);

  const summary = {
    total: resources.length,
    published: resources.filter((resource) => resource.status === 'Publié').length,
    shared: resources.filter((resource) => resource.status === 'Partagé').length,
    pending: resources.filter((resource) => resource.status === 'À revoir').length,
  };

  const teamSummary = [
    { label: 'Disponibles', value: String(initialTeachers.filter((teacher) => teacher.availability === 'Disponible').length), detail: 'enseignants prêts à recevoir une séance' },
    { label: 'À la maison', value: String(initialTeachers.filter((teacher) => teacher.availability === 'À la maison').length), detail: 'supports à préparer' },
    { label: 'En supervision', value: String(initialTeachers.filter((teacher) => teacher.availability === 'En supervision').length), detail: 'suivi pédagogique actif' },
    { label: 'Séances prévues', value: String(initialPlanning.length), detail: 'dans le planning de la semaine' },
  ];

  const upcomingSessions = initialPlanning.slice(0, 3);

  const getStatusClass = (status: TeachingResource['status']) => {
    if (status === 'Publié') return 'publie';
    if (status === 'Partagé') return 'partage';
    return 'revoir';
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.title.trim()) return;

    const newResource: TeachingResource = {
      id: Date.now(),
      title: form.title.trim(),
      subject: form.subject,
      className: form.className,
      teacher: form.teacher,
      type: form.type,
      size: '0.8 Mo',
      updated: 'À l’instant',
      status: 'Publié',
      tags: [form.subject, form.className],
      summary: 'Nouvelle ressource ajoutée depuis le module de supports enseignants.',
    };

    setResources((current) => [newResource, ...current]);
    setForm({
      title: '',
      subject: 'Mathématiques',
      className: '6e A',
      teacher: 'M. Ibrahim A.',
      type: 'PDF',
    });
    setActiveTab('resources');
  };

  return (
    <section className="workspace-page academic-workspace teaching-documents-page">
      <button className="back-link" onClick={onBack}>← Retour à la vue générale</button>

      <div className="workspace-title-row">
        <div>
          <p className="eyebrow">MODULE PÉDAGOGIE</p>
          <h1>Supports enseignants</h1>
          <p>Centralisez les ressources de cours, les planning de séance et l’équipe pédagogique autour de chaque classe.</p>
        </div>
        <span className="module-state is-live">Activé</span>
      </div>

      <section className="section-block teaching-documents-summary">
        <article className="mini-stat-card">
          <span>Total</span>
          <strong>{summary.total}</strong>
          <small>Ressources</small>
        </article>
        <article className="mini-stat-card">
          <span>Publiées</span>
          <strong>{summary.published}</strong>
          <small>Disponibles</small>
        </article>
        <article className="mini-stat-card">
          <span>Partagées</span>
          <strong>{summary.shared}</strong>
          <small>Avec l’équipe</small>
        </article>
        <article className="mini-stat-card">
          <span>À revoir</span>
          <strong>{summary.pending}</strong>
          <small>À valider</small>
        </article>
      </section>

      <section className="teaching-overview-grid" aria-label="Aperçu de l’équipe enseignante">
        {teamSummary.map((item) => (
          <article key={item.label} className="teacher-overview-card">
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.detail}</small>
          </article>
        ))}
      </section>

      <section className="teaching-week-focus" aria-label="Points de vigilance pédagogiques">
        <div className="section-heading compact-heading">
          <div>
            <p className="eyebrow">SUIVI DE LA SEMAINE</p>
            <h2>Points de vigilance</h2>
          </div>
        </div>
        <div className="teaching-focus-grid">
          <div className="focus-card">
            <span>Prochaines séances</span>
            {upcomingSessions.map((session) => (
              <div key={session.id} className="focus-item">
                <strong>{session.subject}</strong>
                <small>{session.teacher} · {session.className}</small>
                <em>{session.time}</em>
              </div>
            ))}
          </div>
          <div className="focus-card">
            <span>Ressources à relancer</span>
            <ul>
              <li>Vérifier les fiches de grammaire en attente.</li>
              <li>Valider la ressource historique partagée.</li>
              <li>Reporter la séance de sciences au laboratoire.</li>
            </ul>
          </div>
        </div>
      </section>

      <div className="teaching-module-tabs" aria-label="Navigation du module pédagogique">
        <button className={activeTab === 'resources' ? 'teaching-module-tab active' : 'teaching-module-tab'} onClick={() => setActiveTab('resources')}>Ressources</button>
        <button className={activeTab === 'team' ? 'teaching-module-tab active' : 'teaching-module-tab'} onClick={() => setActiveTab('team')}>Équipe</button>
        <button className={activeTab === 'planning' ? 'teaching-module-tab active' : 'teaching-module-tab'} onClick={() => setActiveTab('planning')}>Planning</button>
      </div>

      {activeTab === 'resources' && (
        <section className="section-block support-documents-layout">
          <div className="support-documents-main">
            <div className="section-heading">
              <div>
                <p className="eyebrow">RÉSERVÉ AUX ENSEIGNANTS</p>
                <h2>Documents et ressources partagés</h2>
              </div>
              <span className="section-note">{visibleResources.length} fichiers</span>
            </div>

            <div className="toolbar-row">
              <label className="compact-field">
                <span>Recherche</span>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Chercher une ressource…"
                />
              </label>
              <label className="compact-field">
                <span>Classe</span>
                <select value={selectedClass} onChange={(event) => setSelectedClass(event.target.value)}>
                  {classOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label className="compact-field">
                <span>Matière</span>
                <select value={selectedSubject} onChange={(event) => setSelectedSubject(event.target.value)}>
                  {subjectOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
            </div>

            <div className="document-list">
              {visibleResources.map((resource) => (
                <article className="document-card" key={resource.id}>
                  <div className="document-card-header">
                    <span className="file-badge">{resource.type}</span>
                    <span className={`status-badge status-${getStatusClass(resource.status)}`}>
                      {resource.status}
                    </span>
                  </div>
                  <h3>{resource.title}</h3>
                  <p>{resource.summary}</p>
                  <div className="document-meta">
                    <span>{resource.subject}</span>
                    <span>{resource.className}</span>
                    <span>{resource.teacher}</span>
                  </div>
                  <div className="document-footer">
                    <div className="tag-list">
                      {resource.tags.map((tag) => <span key={tag}>{tag}</span>)}
                    </div>
                    <small>{resource.size} · {resource.updated}</small>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <aside className="support-documents-side">
            <div className="form-card support-upload-form">
              <div className="section-heading compact-heading">
                <div>
                  <p className="eyebrow">NOUVELLE RESSOURCE</p>
                  <h2>Ajouter un support</h2>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="stacked-form">
                <label className="field-label">
                  <span>Titre</span>
                  <input
                    value={form.title}
                    onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                    placeholder="Ex. Plan de cours - Chapitre 2"
                  />
                </label>

                <div className="two-columns">
                  <label className="field-label">
                    <span>Matière</span>
                    <select value={form.subject} onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))}>
                      {subjectOptions.filter((option) => option !== 'Tout').map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </label>

                  <label className="field-label">
                    <span>Type</span>
                    <select value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as TeachingResource['type'] }))}>
                      {['PDF', 'PowerPoint', 'Word', 'Vidéo'].map((type) => <option key={type} value={type}>{type}</option>)}
                    </select>
                  </label>
                </div>

                <div className="two-columns">
                  <label className="field-label">
                    <span>Classe</span>
                    <select value={form.className} onChange={(event) => setForm((current) => ({ ...current, className: event.target.value }))}>
                      {classOptions.filter((option) => option !== 'Tout').map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </label>

                  <label className="field-label">
                    <span>Enseignant</span>
                    <select value={form.teacher} onChange={(event) => setForm((current) => ({ ...current, teacher: event.target.value }))}>
                      {['M. Ibrahim A.', 'Mme Salma D.', 'M. Yacine B.', 'Mme Ndeye S.'].map((teacher) => <option key={teacher} value={teacher}>{teacher}</option>)}
                    </select>
                  </label>
                </div>

                <button type="submit" className="primary-button">Publier le support</button>
              </form>
            </div>

            <div className="form-card support-tips-card">
              <div className="section-heading compact-heading">
                <div>
                  <p className="eyebrow">PILOTE DE PARTAGE</p>
                  <h2>Bonnes pratiques</h2>
                </div>
              </div>
              <ul>
                <li>Organisez par classe et par matière pour une recherche rapide.</li>
                <li>Publiez les supports après validation du professeur responsable.</li>
                <li>Diffusez les vidéos et fiches à l’ensemble des enseignants concernés.</li>
              </ul>
            </div>
          </aside>
        </section>
      )}

      {activeTab === 'team' && (
        <section className="section-block teaching-team-layout">
          {teachers.map((teacher) => (
            <article className="teacher-card" key={teacher.id}>
              <div className="teacher-card-header">
                <div className="teacher-avatar">{teacher.name.split(' ').map((word) => word[0]).slice(0, 2).join('')}</div>
                <div>
                  <h3>{teacher.name}</h3>
                  <small>{teacher.specialty}</small>
                </div>
                <span className={`teacher-status ${teacher.availability === 'Disponible' ? 'available' : teacher.availability === 'À la maison' ? 'home' : 'supervision'}`}>{teacher.availability}</span>
              </div>

              <div className="teacher-meta-block">
                <div>
                  <span>Classes</span>
                  <strong>{teacher.classes.join(' · ')}</strong>
                </div>
                <div>
                  <span>Matières</span>
                  <strong>{teacher.subjects.join(' · ')}</strong>
                </div>
              </div>

              <div className="teacher-footer">
                <div>
                  <span>Prochaine séance</span>
                  <strong>{teacher.nextSession}</strong>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}

      {activeTab === 'planning' && (
        <section className="section-block teaching-planning-layout">
          {planning.map((entry) => (
            <article className="planning-card" key={entry.id}>
              <div className="planning-card-top">
                <span className="plan-subject">{entry.subject}</span>
                <span className={`plan-status ${entry.status === 'Confirmé' ? 'confirmed' : 'pending'}`}>{entry.status}</span>
              </div>
              <h3>{entry.className}</h3>
              <div className="planning-detail-row">
                <span>Enseignant</span>
                <strong>{entry.teacher}</strong>
              </div>
              <div className="planning-detail-row">
                <span>Horaire</span>
                <strong>{entry.time}</strong>
              </div>
              <div className="planning-detail-row">
                <span>Salle</span>
                <strong>{entry.room}</strong>
              </div>
            </article>
          ))}
        </section>
      )}
    </section>
  );
}
