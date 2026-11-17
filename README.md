# CSP Nouvel Espoir

Application scolaire multi-établissements : organisation, dossiers scolaires, suivi pédagogique, présences, finances et rapports. Le dépôt est un prototype fonctionnel en évolution; il n’est pas encore certifié pour une exploitation en production.

## Architecture

- `apps/web` : React 18, TypeScript, Vite et PWA.
- `apps/api` : Node.js, NestJS, TypeScript et API REST.
- `apps/api/prisma/schema.prisma` : schéma Prisma actif pour PostgreSQL.
- `compose.yml` : base PostgreSQL locale uniquement; l’API et le web ne sont pas conteneurisés par ce fichier.

Voir [la présentation du SaaS](docs/presentation-saas.md) et [la fiche technique](docs/fiche-technique.md). Les règles métier financières sont décrites dans [docs/finances.md](docs/finances.md).

## Demandes d’inscription en ligne

Le module **Demandes d’inscription en ligne** fournit un formulaire public à partager avec les familles (`/inscription/<slug-de-l’établissement>`), ainsi qu’un écran réservé aux membres autorisés pour examiner, accepter ou refuser les candidatures. Une demande acceptée peut être convertie en dossier élève, responsable légal et inscription dans la classe choisie. Une alerte e-mail peut être envoyée à l’administrateur configuré via SMTP (`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `ONLINE_ENROLLMENT_NOTIFICATION_EMAIL`). Si la configuration est absente ou l’envoi échoue, la demande reste enregistrée et l’interface le signale; un administrateur peut renvoyer l’alerte depuis la liste.

## Prérequis

- Node.js 22 LTS et npm.
- PostgreSQL 16 accessible depuis l’application.
- Git et VS Code.
- Docker Compose facultatif pour démarrer PostgreSQL.

## Fiche des commandes : installation, lancement et gestion

Toutes les commandes ci-dessous s’exécutent depuis la racine du dépôt.

### Installation et configuration initiales

```bash
cd /Users/localadmin/Desktop/projets/scolapro
npm install
cp .env.example .env
```

Complétez ensuite `.env` avec les valeurs requises, notamment `POSTGRES_PASSWORD`, `DATABASE_URL`, `JWT_SECRET` et `PLATFORM_ADMIN_BOOTSTRAP_KEY`. Ne partagez pas ce fichier et ne publiez pas ses secrets.

### Démarrer et gérer la base PostgreSQL locale

```bash
docker compose up -d db       # Démarrer PostgreSQL
docker compose ps             # Voir l’état des conteneurs
docker compose logs -f db     # Suivre les logs PostgreSQL
docker compose stop db        # Arrêter PostgreSQL sans supprimer les données
docker compose down           # Arrêter les conteneurs Compose
```

Préparer la base de développement :

```bash
npm run db:generate
npm run db:push
```

`db:push` est réservé au développement local. Ne l’utilisez pas pour mettre à jour une base de production.

### Lancer l’application en développement

Ouvrez deux terminaux depuis la racine du dépôt.

Terminal 1 — API :

```bash
npm run dev:api
```

Terminal 2 — interface web :

```bash
npm run dev:web
```

Ouvrez l’application :

- Web : http://localhost:5173/
- Présentation : http://localhost:5173/presentation
- Console plateforme : http://localhost:5173/platform
- Santé API : http://localhost:3000/api/v1/health

Pour arrêter chaque serveur de développement, utilisez `Ctrl+C` dans son terminal.

### Vérifications, tests et builds

```bash
npm run typecheck
npm test
npm run test:integration
npm run build:api
npm run build:web
npm run build
```

Le test d’intégration nécessite PostgreSQL et un rôle autorisé à créer des schémas temporaires.

### Démarrer l’API compilée

```bash
npm run build:api
npm run start:prod --workspace @csp/api
```

Le build web est généré dans `apps/web/dist/` avec :

```bash
npm run build:web
```

### Gérer un déploiement Dokploy avec Docker Compose

Après avoir configuré les variables d’environnement de déploiement :

```bash
docker compose --env-file .env -f compose.dokploy.yml up -d --build
docker compose -f compose.dokploy.yml ps
docker compose -f compose.dokploy.yml logs -f
docker compose -f compose.dokploy.yml down
```

Vérifiez l’état de l’API après le déploiement :

```bash
curl https://votre-domaine.com/api/v1/health/ready
```

N’appliquez `npm run db:migrate:deploy` que sur une base dont l’historique de migrations Prisma est correctement initialisé. Pour une base existante sans historique, préparez d’abord une stratégie de sauvegarde et de baseline.

### Autres commandes d’administration

Valider le schéma Prisma :

```bash
npm run prisma:validate --workspace @csp/api
```

Appliquer les migrations préparées sur une base configurée :

```bash
npm run db:migrate:deploy
```

Réinitialiser le mot de passe de l’administrateur plateforme :

```bash
npm run admin:reset-platform-password
```

## Démarrage local

1. Copiez `.env.example` vers `.env` et définissez `POSTGRES_PASSWORD`, `DATABASE_URL`, `JWT_SECRET` et `PLATFORM_ADMIN_BOOTSTRAP_KEY`. Les deux clés secrètes doivent être distinctes et contenir au moins 32 caractères aléatoires. Ne publiez pas `.env`.
2. Démarrez PostgreSQL. Avec Docker : `docker compose up -d db`. Sur macOS, Postgres.app peut remplacer Docker.
3. À la racine du dépôt : `npm install`.
4. Générez le client Prisma et synchronisez la base de développement : `npm run db:generate`, puis `npm run db:push`.
5. Démarrez l’API : `npm run dev:api`.
6. Dans un second terminal, démarrez le web : `npm run dev:web`.

- Web : http://localhost:5173
- Console plateforme : http://localhost:5173/platform
- Santé API : http://localhost:3000/api/v1/health

## Déploiement Dokploy

Le fichier `compose.dokploy.yml` déploie le web, l’API et PostgreSQL. Dans Dokploy, créez une application Docker Compose depuis le dépôt, avec ce fichier Compose. Reliez le domaine HTTPS au service `web` sur le port `80`; le proxy Nginx transmet `/api/` au service API. La base n’a pas de port public.

Définissez les variables dans l’environnement de l’application Dokploy, jamais dans Git :

- `POSTGRES_DB` et `POSTGRES_USER` : nom de la base et utilisateur dédiés.
- `POSTGRES_PASSWORD` : mot de passe long et aléatoire.
- `DATABASE_URL` : `postgresql://USER:PASSWORD@HOST:5432` (par exemple `postgresql://USER:PASSWORD@HOST:5432`). Encodez les caractères spéciaux du mot de passe pour l’URL.
- `JWT_SECRET` et `PLATFORM_ADMIN_BOOTSTRAP_KEY` : deux secrets distincts, aléatoires et d’au moins 32 caractères.
- `WEB_ORIGIN` : origine exacte du site, par exemple `https://ecole.example.com`, sans chemin ni barre oblique finale.

Les migrations versionnées du schéma Prisma s’exécutent avant le démarrage de l’API. Le premier déploiement suppose une base PostgreSQL **vide**. Ne reliez pas la migration initiale à une base existante contenant des données sans établir d’abord une stratégie de baseline et de sauvegarde. Le volume `csp_postgres_data` conserve les données; configurez aussi des sauvegardes externes et testez leur restauration.

Après déploiement, vérifiez `/api/v1/health/ready`, puis initialisez le compte plateforme avec `PLATFORM_ADMIN_BOOTSTRAP_KEY`. Le Compose local `compose.yml` reste destiné au développement.

## Console plateforme

Lors du premier démarrage, ouvrez `/platform` et initialisez le compte administrateur avec `PLATFORM_ADMIN_BOOTSTRAP_KEY`. Ce parcours ne crée qu’un seul administrateur plateforme.

La console permet de créer des établissements et leur premier administrateur, de gérer leur état, leur profil, leurs comptes et leurs permissions. Les espaces école restent séparés des fonctions réservées à la plateforme.

L’administrateur d’une école peut consulter les forfaits et soumettre une demande de changement dans **Facturation et paiements → Abonnement plateforme**. La demande doit être approuvée par un administrateur de la plateforme; elle ne change pas le forfait ni le tarif avant validation.

## État fonctionnel

Le web et l’API proposent l’organisation scolaire, les dossiers élèves et familles, la bibliothèque (catalogue, stocks, prêts et retours), les matières et notes, les bulletins, les présences, la facturation, les paiements manuels, les demandes d’abonnement, les dépenses, la sécurité et les statistiques quotidiennes. L’emploi du temps hebdomadaire est également disponible : il s’appuie sur les affectations pédagogiques et refuse les chevauchements de classe ou d’enseignant. Le module de communication permet de préparer des annonces générales ou adressées à un responsable, de les valider et de les archiver. Il n’envoie pas encore de courriel, SMS ou notification. Le transport scolaire permet de gérer les lignes aller/retour, capacités, véhicules, conducteurs, arrêts et affectations d’élèves. Le module Personnel gère les dossiers des employés non enseignants, leurs fonctions, contrats, dates d’embauche et demandes de congé avec approbation ou refus.

### Catégories de modules

- **Structure et organisation** : années scolaires, niveaux et classes.
- **Scolarité** : élèves, familles et enseignants.
- **Pédagogie et suivi** : notes, évaluations, bulletins et présences.
- **Finance et comptabilité** : facturation, paiements et dépenses.
- **Services complémentaires** : statistiques, bibliothèque, portail parents, sécurité et archives.

Le catalogue présente aussi les documents et certificats, dont les fonctions métier restent à développer. Les demandes d’inscription en ligne sont opérationnelles : formulaire public, examen des demandes par les utilisateurs autorisés, décision et conversion d’une demande acceptée. Les alertes par courriel dépendent de la configuration SMTP.

L’API vérifie les sessions JWT école et plateforme et applique des permissions par rôle/module sur les routes métier couvertes. Cela constitue une base de sécurité, mais ne remplace pas une revue de sécurité et de conformité avant production.

Le portail parents dispose d’une connexion limitée et de comptes associés à un responsable; la session ne donne accès qu’à l’identité familiale et au nombre d’enfants rattachés. Les vues de données scolaires restent fermées et les notifications réelles ne sont pas envoyées. Les moyens Airtel Money, Moov Money, Zamani Cash, Western Union et MoneyGram sont enregistrés manuellement après encaissement; aucune API opérateur ne déclenche ou ne vérifie un transfert.

L’application mobile Expo est un écran de présentation sans authentification ni synchronisation API.

## Vérifications

```bash
npm run typecheck
npm run build:api
npm run build:web
npm test
```

`npm run test:integration` crée un schéma PostgreSQL temporaire `scolapro_test_*`, le synchronise depuis le modèle Prisma, vérifie l’isolation au niveau Prisma et API entre deux écoles, puis supprime ce schéma. La commande exige une URL PostgreSQL pointant vers `localhost`, `127.0.0.1` ou `::1` et un rôle autorisé à créer des schémas. Elle ne modifie pas les tables du schéma `public`.

`db:push` est réservé au développement local. Utilisez `npm run db:migrate:deploy` uniquement sur une base dont l’historique de migrations Prisma est correctement initialisé. Pour une base existante sans historique, établissez et vérifiez d’abord une stratégie de baseline et de sauvegarde; ne lancez pas cette commande directement.

## Important

Utilisez des données fictives en développement et en démonstration. Avant toute utilisation avec des données réelles, validez l’isolation multi-établissements, les permissions, les sauvegardes et restaurations, la journalisation, la gestion des incidents et les obligations réglementaires applicables. Les états financiers de l’application ne remplacent pas la comptabilité officielle.

### macOS avec Postgres.app

Postgres.app 2.9.6 avec PostgreSQL 16 prend en charge macOS 10.15 et ultérieur. Sur une installation neuve, le cluster local peut être initialisé puis démarré avec `initdb` et `pg_ctl` depuis `~/Applications/Postgres.app/Contents/Versions/16/bin`, dans `~/Library/Application Support/Postgres/var-16`, en écoutant uniquement sur `127.0.0.1:5432`. Après un redémarrage du Mac, démarrez PostgreSQL avant l’API.

Cette écoute est volontairement limitée au Mac local; ne la remplacez pas par `0.0.0.0` pour connecter Dokploy. En déploiement Dokploy, PostgreSQL est un service privé du réseau Compose et l’API s’y connecte avec l’hôte `db` sur le port `5432`.
# ndev
