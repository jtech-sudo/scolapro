# Fiche technique

## Identification

- Produit : CSP Nouvel Espoir, application de gestion scolaire multi-établissements.
- Version du dépôt : `0.1.0`.
- État : prototype fonctionnel en développement; non certifié pour une exploitation scolaire en production.
- Langue de l’interface : français.
- Architecture : client web, API REST, base PostgreSQL; application mobile séparée à l’état de socle initial.

## Architecture et technologies

| Composant | Technologies | État |
| --- | --- | --- |
| Web | React 18, TypeScript, Vite 6, PWA | Modules scolaires accessibles dans le navigateur |
| API | Node.js, NestJS 10, TypeScript, REST `/api/v1` | Services métiers et validation des requêtes |
| Données | PostgreSQL 16, Prisma 6 | Schéma actif dans `apps/api/prisma/schema.prisma` |
| Mobile | React Native 0.76, Expo 52 | Écran de présentation; pas encore raccordé à l’API |
| Conteneur local | Docker Compose | Le fichier Compose démarre PostgreSQL uniquement |

Le fichier `database/prisma/schema.prisma` est une copie historique; les commandes Prisma du workspace API utilisent `apps/api/prisma/schema.prisma`.

## Modules applicatifs

- Plateforme : établissements, abonnements, paiements de souscription, comptes et paramètres centralisés.
- École : organisation, élèves et responsables, bibliothèque, enseignants et personnel, notes, bulletins, présences, facturation, dépenses, statistiques, sécurité, emploi du temps, transport et demandes d’inscription en ligne.
- Communication : annonces préparables, validables et archivables; aucun envoi de courriel, SMS ou notification n’est effectué.
- Portail parents : authentification limitée à l’identité familiale; consultation des données scolaires et notifications non disponibles.
- Documents et certificats : présentation dans le catalogue, fonctions métier non implémentées.

## API

- Préfixe : `/api/v1`.
- Santé : `GET /api/v1/health` et `GET /api/v1/health/ready`.
- Authentification école : `POST /api/v1/auth/login`, `GET /api/v1/auth/me`, `GET /api/v1/auth/schools` et changement d’école.
- Authentification parent : `POST /api/v1/parent-portal/parent/login` et `GET /api/v1/parent-portal/parent/me`.
- Console plateforme : routes `/api/v1/platform/*`, authentification et jeton séparés des sessions école.
- Domaines principaux : `/school-years`, `/terms`, `/levels`, `/classes`, `/students`, `/guardians`, `/teachers`, `/personnel`, `/library/books`, `/library/loans`, `/academic`, `/report-cards`, `/attendance`, `/timetable`, `/transport`, `/online-enrollment`, `/communication`, `/fee-types`, `/invoices`, `/payments`, `/expenses`, `/finance`, `/statistics`, `/parent-portal`.
- Rapport journalier : `GET /api/v1/statistics/daily?date=AAAA-MM-JJ`.

Les corps de requête sont validés par `class-validator` et `class-transformer`; les champs non déclarés sont rejetés. L’API utilise un middleware global qui vérifie les jetons et applique les permissions associées aux modules. Les routes publiques sont limitées à la santé, aux statuts d’initialisation et aux parcours de connexion/bootstrap prévus.

## Authentification et cloisonnement

- Jetons JWT distincts pour les administrateurs plateforme et les comptes école.
- Jeton parent distinct, lié à un compte parent, une école et un responsable précis; le middleware revalide ce lien à chaque requête.
- Le jeton parent n’autorise que la route d’identité familiale; les routes élèves et administration répondent `403`.
- Les comptes école sont rattachés à une école par une appartenance (`SchoolMembership`) et un rôle.
- Les permissions sont configurables par rôle et par module; le middleware les vérifie sur les routes métier couvertes.
- Les requêtes métier sont exécutées dans un contexte d’établissement; les données portent un identifiant `schoolId`.
- Les événements de sécurité et les modifications métier sont conservés dans des journaux d’audit séparés au niveau plateforme et école.
- Les tests automatisés couvrent le contexte d’établissement, certaines lectures et écritures Prisma, l’authentification multi-école et des opérations inter-écoles refusées.
- La suite d’intégration exige une base PostgreSQL locale et crée un schéma temporaire dédié; une exécution réussie sur cet environnement reste nécessaire avant de conclure à la validation de l’isolation.
- Le portail parent reste limité à la route d’identité familiale; les consultations scolaires doivent rester désactivées tant que les permissions parent correspondantes ne sont pas développées et testées.

Ces mécanismes constituent une base de sécurité, pas une certification de production. Une revue d’autorisation, des tests d’isolation multi-tenant, des limites de débit, la politique de sessions, les sauvegardes et la gestion des incidents restent à valider avant mise en service réelle.

## Données métier

Principales entités : établissements, profils, comptes, appartenances et permissions; années, périodes, niveaux, classes et inscriptions; élèves, responsables et liens familiaux; ouvrages et prêts de bibliothèque; évaluations, notes et bulletins; séances et enregistrements de présence; types de frais, factures, échéances, paiements et allocations; catégories et dépenses; paramètres du portail, annonces et journaux d’audit.

Les montants sont stockés en `Decimal`. Les factures peuvent recevoir plusieurs paiements et les paiements peuvent être répartis entre plusieurs factures. Les annulations financières sont tracées plutôt que supprimées silencieusement.

## Configuration locale

Prérequis : Node.js 22 LTS, npm et PostgreSQL 16. Docker Compose est facultatif pour la base locale.

Variables à définir dans `.env` à partir de `.env.example` :

- `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` : connexion PostgreSQL.
- `DATABASE_URL` : URL utilisée par Prisma.
- `API_PORT` : port API, `3000` par défaut.
- `JWT_SECRET` : secret aléatoire d’au moins 32 caractères.
- `PLATFORM_ADMIN_BOOTSTRAP_KEY` : clé distincte d’au moins 32 caractères pour l’initialisation du premier administrateur plateforme.
- `VITE_API_BASE_URL` : URL API utilisée par le client web.

Ne jamais versionner `.env`, publier des jetons ou placer des secrets opérateur dans le client web.

## Commandes de développement

```bash
npm install
npm run db:generate
npm run db:push
npm run dev:api
npm run dev:web
```

Contrôles et builds :

```bash
npm run typecheck
npm run build:api
npm run build:web
```

`npm run db:push` convient au développement local. Pour les environnements partagés ou de production, préparer et appliquer des migrations Prisma versionnées; ne pas synchroniser le schéma de production avec `db:push`.

## Ports et URL locales

- Web : `http://localhost:5173`.
- Console plateforme : `http://localhost:5173/platform`.
- API : `http://localhost:3000/api/v1`.
- PostgreSQL Compose : `127.0.0.1:5432`.

## Limites avant production

- L’application mobile doit être raccordée à l’API et recevoir ses parcours d’authentification et de synchronisation.
- Le portail fournit une connexion parent limitée à l’identité familiale; les vues des données d’élèves restent désactivées et notifications/messagerie ne sont pas livrées.
- Les modules d’emploi du temps, de transport, de personnel et d’inscription en ligne sont présents; leur présence ne vaut pas validation complète des processus métier en production.
- Les paiements mobiles sont saisis manuellement; aucune API Nita, Amana, Wave ou autre opérateur n’est intégrée.
- Les rapports financiers ne remplacent pas la comptabilité officielle ni les rapprochements bancaires/opérateurs.
- Prévoir migrations, sauvegardes/restaurations testées, TLS, gestion des secrets, observabilité, tests d’autorisation et d’isolation, procédure de support et validation juridique/réglementaire.
