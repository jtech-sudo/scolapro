type ModuleCategoryId = 'structure' | 'students' | 'pedagogy' | 'finance' | 'services';

type SchoolModule = {
  id: string;
  number: string;
  title: string;
  description: string;
  category: ModuleCategoryId;
  options: string[];
};

export const moduleCategories: Array<{ id: ModuleCategoryId; title: string; description: string }> = [
  { id: 'structure', title: 'Organisation scolaire', description: 'Années, classes et dossiers des élèves.' },
  { id: 'students', title: 'Vie scolaire et familles', description: 'Présences et services destinés aux familles.' },
  { id: 'pedagogy', title: 'Pédagogie et résultats', description: 'Évaluations, notes, bulletins et ressources.' },
  { id: 'finance', title: 'Finances', description: 'Facturation, trésorerie et comptabilité.' },
  { id: 'services', title: 'Pilotage et services', description: 'Bibliothèque, statistiques, sécurité et archives.' },
];

export const modules: SchoolModule[] = [
  {
    id: 'school-year',
    number: '01',
    title: 'Années et classes',
    description: 'Organisez les années scolaires, les niveaux et les inscriptions.',
    category: 'structure',
    options: ['Années scolaires', 'Niveaux et classes', 'Inscriptions', 'Matricules'],
  },
  {
    id: 'people',
    number: '02',
    title: 'Élèves et scolarité',
    description: 'Gérez les inscriptions, les dossiers élèves, les familles et les affectations scolaires.',
    category: 'structure',
    options: [
      'Inscriptions et réinscriptions',
      'Dossiers des élèves et matricules',
      'Familles et responsables',
      'Classes, niveaux et affectations',
      'Historique scolaire, transferts et sorties',
    ],
  },
  {
    id: 'attendance',
    number: '03',
    title: 'Présences',
    description: 'Suivez les présences, absences et retards par classe.',
    category: 'students',
    options: ['Appel par classe', 'Absences', 'Retards', 'Suivi des justificatifs'],
  },
  {
    id: 'timetable',
    number: '13',
    title: 'Emploi du temps',
    description: 'Planifiez les cours par classe, matière et enseignant sur la semaine.',
    category: 'pedagogy',
    options: ['Planning hebdomadaire par classe', 'Affectation des salles', 'Prévention des conflits de cours', 'Consultation par enseignant'],
  },
  {
    id: 'grades',
    number: '04',
    title: 'Évaluations et bulletins',
    description: 'Gérez les devoirs, les notes, les évaluations et les bulletins.',
    category: 'pedagogy',
    options: [
      'Devoirs et évaluations',
      'Exercices',
      'Quiz',
      'Matières et coefficients',
      'Saisie des notes',
      'Bulletins et appréciations',
    ],
  },
  {
    id: 'teaching-documents',
    number: '05',
    title: 'Supports enseignants',
    description: 'Déposez et partagez les présentations, documents et tableaux blancs des enseignants du lycée.',
    category: 'pedagogy',
    options: [
      'Dépôt de présentations PDF, PowerPoint et Word',
      'Exercices et supports par classe et matière',
      'Tableau blanc et ressources visuelles',
      'Partage avec les enseignants et administrateurs de l’école',
    ],
  },
  {
    id: 'billing',
    number: '06',
    title: 'Facturation',
    description: 'Gérez les frais scolaires, paiements partiels, soldes et reçus de manière structurée.',
    category: 'finance',
    options: ['Frais et factures', 'Paiements et échéanciers', 'Soldes', 'Reçus et annulations tracées'],
  },
  {
    id: 'finance',
    number: '07',
    title: 'Trésorerie',
    description: 'Suivez les recettes, les dépenses et le solde de trésorerie de l’établissement.',
    category: 'finance',
    options: ['Journal des recettes et dépenses', 'Enregistrer une dépense', 'Catégories de dépenses', 'Rapports financiers et export CSV'],
  },
  {
    id: 'accounting',
    number: '08',
    title: 'Comptabilité générale',
    description: 'Suivez le plan comptable, les comptes de résultat et les écritures de gestion.',
    category: 'finance',
    options: ['Plan comptable', 'Comptes de résultat', 'Bilan de gestion', 'Écritures de gestion et balances'],
  },
  {
    id: 'parent-portal',
    number: '09',
    title: 'Portail parents',
    description: 'Préparez les espaces de consultation et les communications aux familles.',
    category: 'students',
    options: ['Accès des responsables', 'Résultats et bulletins', 'Situation des paiements', 'Notifications'],
  },
  {
    id: 'communication',
    number: '14',
    title: 'Communication aux familles',
    description: 'Préparez les annonces et les informations destinées aux responsables.',
    category: 'students',
    options: ['Annonces de l’établissement', 'Messages aux responsables', 'Notifications de classe', 'Historique des communications'],
  },
  {
    id: 'transport',
    number: '15',
    title: 'Transport scolaire',
    description: 'Organisez les lignes, arrêts, véhicules et affectations de transport des élèves.',
    category: 'students',
    options: ['Lignes aller et retour', 'Véhicules, capacités et chauffeurs', 'Arrêts et horaires', 'Affectation des élèves actifs'],
  },
  {
    id: 'personnel',
    number: '16',
    title: 'Gestion du personnel',
    description: 'Centralisez les dossiers du personnel, les fonctions, les contrats et les demandes de congé.',
    category: 'structure',
    options: ['Dossiers administratifs', 'Fonctions, contrats et embauches', 'Demandes et validation des congés', 'Archivage des dossiers'],
  },
  {
    id: 'documents',
    number: '17',
    title: 'Documents et certificats',
    description: 'Préparez les documents scolaires et retrouvez les pièces des élèves.',
    category: 'services',
    options: ['Certificats de scolarité', 'Attestations et relevés', 'Documents des élèves', 'Historique des documents émis'],
  },
  {
    id: 'online-enrollment',
    number: '18',
    title: 'Demandes d’inscription en ligne',
    description: 'Recevez et traitez les demandes d’inscription avant la création du dossier.',
    category: 'structure',
    options: ['Formulaire de candidature', 'Examen des dossiers', 'Suivi des demandes', 'Conversion en inscription élève'],
  },
  {
    id: 'library',
    number: '10',
    title: 'Bibliothèque',
    description: 'Gérez le catalogue, les exemplaires et les prêts aux élèves.',
    category: 'services',
    options: ['Catalogue des ouvrages', 'Disponibilité des exemplaires', 'Prêts et retours', 'Retards de restitution'],
  },
  {
    id: 'statistics',
    number: '11',
    title: 'Statistiques et rapports',
    description: 'Consultez les indicateurs et les activités enregistrées pour une journée.',
    category: 'services',
    options: ['Présences', 'Paiements et dépenses', 'Factures émises', 'Journal des activités'],
  },
  {
    id: 'security',
    number: '12',
    title: 'Sécurité et archives',
    description: 'Prévoyez la traçabilité, les sauvegardes et l’archivage.',
    category: 'services',
    options: ['Journal d’audit', 'Sauvegardes', 'Archivage', 'Historique des corrections'],
  },
];