# Présentation du SaaS scolaire

## Vue d’ensemble

CSP Nouvel Espoir est une application de gestion scolaire multi-établissements. Elle centralise l’organisation des années et classes, les dossiers des élèves, le suivi pédagogique, les présences et la gestion financière. Une console plateforme permet d’administrer les établissements et leurs accès.

Le produit est actuellement un prototype fonctionnel en évolution. L’interface web et l’API couvrent plusieurs workflows; l’application mobile et le portail parents ne sont pas encore opérationnels pour un usage autonome.

## Utilisateurs concernés

- Administrateur de la plateforme : crée les écoles, gère leur état, leurs comptes et leurs paramètres centralisés.
- Personnel de l’établissement : intervient dans les modules autorisés par son rôle, par exemple administration, direction, secrétariat, pédagogie, comptabilité ou caisse.
- Familles : une connexion parent limitée est disponible; elle confirme l’identité familiale et le nombre d’enfants rattachés. Les dossiers scolaires ne sont pas encore consultables par les familles.

## Fonctionnalités web disponibles

- Gestion multi-écoles depuis la console plateforme : création d’établissements et de leur premier administrateur, activation ou suspension, paramètres, comptes et permissions.
- Organisation scolaire : années, périodes, niveaux, classes, enseignants et matières.
- Dossiers scolaires : élèves, inscriptions, responsables familiaux et associations élève-responsable.
- Bibliothèque : catalogue des ouvrages, suivi des exemplaires disponibles, prêts aux élèves, retours, retards et historique.
- Suivi pédagogique : évaluations, notes, règles de calcul et préparation des bulletins.
- Présences : appels par classe, enregistrement des statuts, justifications et rapports par période.
- Facturation : types de frais, factures, paiements partiels, échéanciers, reçus et soldes.
- Dépenses : catégories, écritures, annulations tracées et synthèses financières.
- Statistiques : rapport quotidien filtré par date, incluant inscriptions, présences, factures, paiements, dépenses et événements d’audit; impression disponible.
- Sécurité et archives : permissions par rôle, journal d’audit et archivage de dossiers.

## Fonctionnalités en préparation

- Portail parents : comptes responsables et session parent limitée existent. Les vues de contenu par enfant et l’application des options de consultation ne sont pas encore déployées; le portail de données reste désactivé.
- Notifications : les options de courriel et SMS ne déclenchent aucune livraison réelle.
- Paiements mobiles : Airtel Money, Moov Money, Zamani Cash, Western Union et MoneyGram sont des moyens que l’on peut noter après encaissement; aucune API opérateur ne déclenche ou ne vérifie un transfert.
- Application mobile : le projet Expo contient un écran de présentation; les modules, l’authentification et la synchronisation avec l’API restent à développer.

## Parcours usuels

1. Créer l’établissement dans la console plateforme et ouvrir l’espace école.
2. Configurer l’année scolaire, les niveaux et les classes.
3. Inscrire les élèves et rattacher les responsables familiaux.
4. Configurer les matières, évaluations et règles pédagogiques selon les décisions de la direction.
5. Pour les finances, créer les types de frais, émettre une facture, enregistrer les paiements effectivement reçus et suivre les soldes.
6. Utiliser le rapport journalier pour consulter et imprimer les activités enregistrées à une date choisie.

## Limites et usage des données

Les rapports financiers sont des outils de suivi et ne remplacent pas la comptabilité officielle ni les pièces justificatives. Les paiements saisis manuellement ne sont pas vérifiés auprès d’un opérateur.

Le portail parents reste désactivé jusqu’à l’implémentation et la validation des mécanismes d’authentification et d’autorisation. Les environnements de développement et de démonstration doivent utiliser des données fictives. L’import de données réelles nécessite une revue de sécurité, des sauvegardes vérifiées, des procédures de support et la validation des obligations réglementaires applicables.
