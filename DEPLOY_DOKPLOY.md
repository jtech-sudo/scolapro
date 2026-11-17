# Déploiement Dokploy sur Proxmox

Ce projet est prêt pour un déploiement via Docker Compose avec Dokploy.

## Fichier Compose

Le fichier principal est :

- [compose.dokploy.yml](compose.dokploy.yml)

Il démarre automatiquement :
- PostgreSQL
- migration Prisma
- API NestJS
- frontend web

## 1. Préparer le dépôt Dokploy

Dans Dokploy :
1. Créer un projet
2. Connecter le dépôt Git
3. Choisir le type "Docker Compose"
4. Sélectionner le fichier [compose.dokploy.yml](compose.dokploy.yml)
5. Définir les variables d’environnement à partir du fichier [dokploy.env.example](dokploy.env.example)

## 2. Variables d’environnement

Utiliser ce modèle :

```bash
POSTGRES_DB=csp_demo
POSTGRES_USER=csp_app
POSTGRES_PASSWORD=CHANGE_ME_TO_A_STRONG_PASSWORD
DATABASE_URL=postgresql://csp_app:CHANGE_ME_TO_A_STRONG_PASSWORD@db:5432/csp_demo?schema=public
WEB_ORIGIN=https://sahelink.galmi.org
JWT_SECRET=REPLACE_WITH_A_RANDOM_SECRET_AT_LEAST_32_CHARACTERS
PLATFORM_ADMIN_BOOTSTRAP_KEY=REPLACE_WITH_A_SEPARATE_RANDOM_KEY_AT_LEAST_32_CHARACTERS
```

## 3. Domaine public

Le domaine configuré pour ce déploiement est :

```bash
WEB_ORIGIN=https://sahelink.galmi.org
```

## 4. Lancement local de vérification

Depuis la racine du projet :

```bash
docker compose --env-file .env -f compose.dokploy.yml up -d --build
```

## 5. Vérification une fois déployé

- Site web : `https://sahelink.galmi.org`
- API santé : `https://sahelink.galmi.org/api/v1/health`
- Admin plateforme : `https://sahelink.galmi.org/platform`

## 6. Bonnes pratiques Proxmox

- Utiliser une VM Ubuntu dédiée pour Dokploy
- Ouvrir uniquement les ports 80 et 443
- Utiliser un domaine HTTPS avec certificat automatique
- Garder les secrets dans l’interface Dokploy et non dans le code

## 7. Si tu veux un accès local temporaire

Pour une démonstration interne, tu peux aussi utiliser :

```text
http://10.0.18.247:5174
```

mais pour un client final, il est conseillé d’utiliser un vrai domaine HTTPS.
