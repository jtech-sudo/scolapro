# Cahier des charges — CSP Nouvel Espoir de Galmi

## 1. Contexte et objectif

Le projet CSP Nouvel Espoir vise à mettre en place une solution de gestion scolaire multi-établissements destinée à un environnement éducatif de type primaire, collège et lycée. L’objectif principal est de centraliser les opérations administratives, pédagogiques, financières et de suivi des élèves dans une plateforme unique, fiable et évolutive.

Le produit doit permettre à la direction, aux responsables d’établissement, aux enseignants et aux équipes administratives de gérer le quotidien scolaire sans dépendre de plusieurs outils non cohérents. La solution est conçue comme une plateforme SaaS avec une architecture modulaire et des données cloisonnées par établissement.

Le dépôt actuel est un prototype fonctionnel en évolution. Il ne constitue pas encore un système certifié pour une exploitation scolaire en production réelle.

## 2. Périmètre fonctionnel

### 2.1. Plateforme centrale
- Gestion des établissements et de leurs paramètres.
- Gestion des comptes administrateurs plateforme.
- Gestion des abonnements et des demandes de changement de forfait.
- Suivi des paiements et des données de facturation de la plateforme.
- Séparation claire entre les fonctions plateforme et les fonctions propres à chaque école.

### 2.2. Espace école
- Organisation interne de l’établissement (années scolaires, périodes, niveaux, classes).
- Gestion des inscriptions et des dossiers élèves.
- Gestion des familles et des responsables légaux.
- Gestion des enseignants, des matières et des affectations.
- Gestion des évaluations, notes, coefficients et bulletins.
- Suivi des présences, absences et retards.
- Gestion des finances scolaires et des dépenses.
- Gestion des documents et des rapports d’activité.

### 2.3. Portail parents
- Accès limité à l’identité familiale, avec authentification dédiée.
- Consultation des informations parentales autorisées.
- Gestion de l’accès aux ressources concernées par la famille uniquement.
- Ce module est prévu progressivement et reste limité dans le prototype actuel.

### 2.4. Demandes d’inscription en ligne
- Formulaire public de candidature accessible via un slug d’établissement.
- Soumission de dossiers par les familles.
- Consultation, validation et refus des demandes par les administrateurs autorisés.
- Conversion d’une demande acceptée en dossier élève, responsable légal et inscription dans la classe choisie.
- Envoi d’alerte mail à l’administrateur configuré si le paramétrage SMTP est disponible.

## 3. Utilisateurs et rôles

### 3.1. Administrateur plateforme
- Gère le catalogue des établissements.
- Valide les demandes de changement d’abonnement.
- Administre le paramétrage central et la sécurité globale.
- Gère les comptes de niveau plateforme.

### 3.2. Administrateur d’établissement
- Gère les paramètres de l’école.
- Crée et administre les comptes utilisateur internes.
- Gère les rôles et permissions associés.
- Valide les opérations pédagogiques et financières.

### 3.3. Enseignant
- Consulte les classes et élèves assignés.
- Saisit les évaluations, notes et absences.
- Consulte les bulletins et le suivi pédagogique.

### 3.4. Responsable administratif / comptabilité
- Gère les frais, les factures, les reçus et les paiements.
- Suivi des soldes et des échéances.
- Consulte les données financières et les états de dépenses.

### 3.5. Parent / responsable légal
- Accède uniquement aux informations familiales et scolaires autorisées.
- Ne peut pas accéder aux fonctions d’administration ni aux données d’autres familles.

## 4. Exigences fonctionnelles

### 4.1. Administration et sécurité
- Gestion des établissements, des comptes et des rôles.
- Authentification séparée pour la plateforme et les écoles.
- Gestion des permissions par module et par rôle.
- Journal d’audit des actions sensibles.
- Blocage des suppressions silencieuses pour les éléments financiers et critiques.

### 4.2. Gestion scolaire
- Gestion des années scolaires, périodes, niveaux, classes, inscriptions.
- Suivi des élèves, des responsables légaux et des liens familiaux.
- Gestion des enseignants, des matières et des coefficients.
- Suivi des évaluations, notes et résultats.
- Génération de bulletins avec calculs paramétrables selon le niveau et la classe.

### 4.3. Présences et suivi
- Gestion des absences, retards et justifications.
- Consultation des statistiques de présence.
- Alertes et suivi par classe ou par élève.

### 4.4. Finances
- Création de types de frais, factures, échéances et paiements.
- Gestion des paiements partiels et des répartitions sur plusieurs factures.
- Gestion des soldes, reçus et allocations.
- Suivi des dépenses et des données financières.
- Génération de tableaux de bord et de rapports financiers.

### 4.5. Bibliothèque
- Gestion du catalogue des ouvrages.
- Suivi des prêts et retours.
- Gestion des emprunteurs et des statuts de prêt.

### 4.6. Portail parent et notifications
- Présentation de procédures et informations de communication.
- Accès sécurisé à l’espace parent limité au périmètre autorisé.
- Préparation du mécanisme de notifications et d’alerte.

### 4.7. Inscriptions en ligne
- Formulaire de candidature public.
- Validation par l’administration.
- Conversion vers dossier élève et inscription.
- Traitement des notifications email via SMTP.

## 5. Exigences techniques

### 5.1. Architecture
- Frontend web : React 18 + TypeScript + Vite.
- Interface PWA compatible navigation web.
- API backend : Node.js + NestJS + TypeScript.
- Base de données : PostgreSQL 16.
- ORM : Prisma.
- API exposée avec préfixe `/api/v1`.
- Séparation nette entre logique métier, contrôleurs et accès aux données.

### 5.2. Sécurité
- JWT distincts pour les utilisateurs plateforme, école et parent.
- Middleware d’autorisation et vérification des permissions.
- Contexte d’établissement obligatoirement appliqué sur les requêtes métier.
- Données identifiées par `schoolId`.
- Rôles et permissions configurables.
- Journalisation des événements sensibles et des mutations métier.
- Gestion des secrets via variables d’environnement.
- Protection des endpoints publics et des accès non autorisés.

### 5.3. Déploiement
- Cible de déploiement : Docker Compose, Ubuntu Server, Dokploy, Proxmox.
- Déploiement avec web, API et PostgreSQL distincts.
- Base de données non exposée publiquement en production.
- Variables d’environnement définies hors du dépôt Git.
- Migrations Prisma versionnées pour les environnements de partage et production.

### 5.4. Qualité logicielle
- Code type-safe avec validation des entrées.
- Validation des requêtes côté API.
- Tests d’intégration et contrôles de build.
- Vérification des migrations avant mise en production.
- Sauvegardes, restaurations et procédures de reprise d’activité à prévoir.

## 6. Exigences non fonctionnelles

### 6.1. Performance
- Temps de réponse acceptable pour les opérations courantes de gestion scolaire.
- Traitement fluide des listes, filtres et tableaux de bord.
- Gestion de plusieurs établissements et d’un volume d’utilisateurs croissant.

### 6.2. Disponibilité et robustesse
- Déploiement capable de garantir une continuité de service raisonnable.
- Procédures de sauvegarde et restauration testées.
- Gestion des erreurs fonctionnelle et technique de façon explicite.

### 6.3. Confiance et traçabilité
- Audit des modifications critiques.
- Traçabilité des décisions financières et pédagogiques.
- Règles de validation et verrouillage des résultats validés.

### 6.4. Conformité et sécurité informatique
- Sécurisation des accès et des secrets.
- Gestion des comptes, des sessions, des permissions.
- Protection contre les accès non autorisés et les fuites de données.
- Revue de sécurité et tests d’isolation multi-tenant à réaliser avant mise en service réelle.

## 7. Contraintes et limites actuelles

- Le projet est encore un prototype fonctionnel et n’est pas certifié pour une utilisation en production.
- L’application mobile n’est pas encore raccordée intégralement à l’API.
- Le portail parent dispose d’une connexion limitée à l’identité familiale; la consultation des données scolaires et les notifications restent à développer.
- Les paiements en ligne tiers ne sont pas intégrés dans la version actuelle.
- Les rapports et outils financiers ne remplacent pas une comptabilité officielle ou les rapprochements bancaires.
- Les données réelles ne doivent être importées qu’après validation de sécurité, sauvegarde et procédure de reprise.

### 7.1. État d’avancement observé

| Domaine | État constaté dans le projet | Travail restant |
| --- | --- | --- |
| Plateforme et gestion multi-établissements | Console plateforme, comptes école, appartenances, rôles et permissions présents. | Poursuivre les tests d’isolation sur toutes les routes et tous les rôles. |
| Gestion scolaire | Organisation, élèves et familles, pédagogie, bulletins, présences et bibliothèque disponibles dans le web et l’API. | Valider les parcours métier complets avec des profils d’utilisateurs représentatifs. |
| Finances | Facturation, paiements saisis manuellement, dépenses et rapports disponibles. | Aucun paiement opérateur n’est déclenché ou vérifié automatiquement; valider les rapprochements et les règles comptables avec l’établissement. |
| Inscriptions en ligne | Formulaire public, examen des demandes, décision et conversion vers un dossier élève disponibles; notifications par courriel configurables. | Tester les cas de rejet, de doublon, d’échec de notification et de reprise. |
| Emploi du temps, transport et personnel | Modules présents dans l’interface et l’API. | Vérifier les règles et les scénarios réels propres à chaque établissement. |
| Portail parent et communication | Connexion parent limitée à l’identité familiale; annonces préparables, validables et archivables. | Ajouter les vues scolaires autorisées et les canaux d’envoi avant d’annoncer ces fonctions comme opérationnelles. |
| Documents et certificats | Présentation du module dans le catalogue. | Les fonctions métier restent à développer. |
| Application mobile | Écran de présentation Expo. | Authentification, intégration API et synchronisation restent à développer. |
| Préparation de production | Architecture de déploiement et migrations documentées. | Revue de sécurité, restauration de sauvegarde, exploitation, conformité et tests d’acceptation non encore validés. |

Les tests automatisés couvrent notamment le contexte d’établissement, le filtrage des lectures et écritures, l’authentification multi-école et le refus de certaines opérations inter-écoles. Le test d’intégration crée un schéma temporaire et n’accepte qu’une base PostgreSQL locale. Lors de l’évaluation du 17 novembre 2026, son exécution a été arrêtée avant les tests, car la base configurée ne satisfaisait pas cette condition. L’isolation doit donc encore être confirmée par une exécution réussie de cette suite sur un environnement local dédié.

### 7.2. Préparation d’un pilote avec des données fictives

Le pilote doit se dérouler dans un environnement distinct de la production, avec des comptes, élèves, familles, résultats scolaires et opérations financières entièrement fictifs.

Avant le pilote :
- créer au moins deux établissements de test et des utilisateurs de rôles différents;
- exécuter avec succès les tests d’isolation sur une base temporaire locale;
- vérifier qu’un compte ne peut ni consulter ni modifier les données d’un autre établissement, y compris en changeant les identifiants transmis à l’API;
- vérifier les parcours d’authentification, les permissions, le changement d’établissement et les sessions parent;
- tester les parcours scolaires et financiers représentatifs, ainsi que les erreurs et annulations;
- vérifier une sauvegarde et sa restauration dans un environnement de test;
- consigner les anomalies, leur correction et les validations métier de l’établissement pilote.

Le pilote ne doit pas être considéré comme une autorisation d’importer des données réelles. Toute mise en service réelle reste conditionnée à la revue de sécurité, à la validation des obligations applicables et à une procédure de sauvegarde et de reprise testée.

## 8. Contraintes techniques et organisationnelles

- Langue principale : français.
- Base PostgreSQL comme source unique de vérité applicative.
- L’API est l’unique accès applicatif à la base.
- Le code doit rester modulaire afin de permettre l’ajout progressif de nouveaux modules.
- Les secrets et variables sensibles ne doivent jamais être versionnés dans le dépôt.
- Le développement local et les environnements de production doivent utiliser des stratégies de migration distinctes.

## 9. Critères de validation du projet

Le projet sera considéré comme satisfaisant si :
- la plateforme permet la gestion complète de l’administration scolaire d’un établissement ;
- la séparation des rôles et permissions est effective ;
- les dossiers élèves et familles sont gérés de manière fiable ;
- les évaluations et bulletins fonctionnent avec des règles configurables ;
- les finances et les dépenses sont suivies de façon traçable ;
- les demandes d’inscription en ligne sont opérationnelles ;
- les données sont sécurisées et les accès sont cloisonnés par établissement ;
- le déploiement est documenté et les sauvegardes sont prévues.

## 10. Livrables attendus

- Application web fonctionnelle pour la gestion scolaire.
- API REST sécurisée et documentée.
- Base PostgreSQL structurée et évolutive.
- Gestion des permissions et du journal d’audit.
- Modèle financier et pédagogique exploitable.
- Documentation technique et procédure de déploiement.
- Procédure de démarrage local et de mise en production.

## 11. Plan de mise en œuvre recommandé

### Phase 1 — Fondations
- Initialisation du projet, environnement, base de données et sécurité de base.
- Création des comptes plateforme et établissement.
- Gestion des rôles et des permissions.

### Phase 2 — Gestion scolaire de base
- Années, niveaux, classes, inscriptions et fichiers élèves.
- Gestion des enseignants et des matières.
- Suivi des évaluations et notes.

### Phase 3 — Finances et reporting
- Frais, factures, paiements, soldes et dépenses.
- Tableaux de bord et rapports financiers.

### Phase 4 — Portail parent et inscriptions en ligne
- Formulaires publics, demandes d’inscription, validation et alertes.
- Accès parent limité et sécurisé.

### Phase 5 — Stabilisation et production
- Révision sécurité, tests d’isolation multi-tenant, backups, observabilité et préparation de mise en service.

## 12. Conclusion

Le cahier des charges de CSP Nouvel Espoir décrit une solution de gestion scolaire multi-établissements en cours de réalisation. Le projet dispose déjà de plusieurs modules fonctionnels, mais le portail parent, l’application mobile et la préparation à la production restent incomplets. La poursuite du projet doit privilégier la validation de l’isolation des données, l’harmonisation de la documentation et un pilote sur données fictives avant toute utilisation réelle.
