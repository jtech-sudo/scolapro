# Finances scolaires — règles initiales

- Une facture peut recevoir plusieurs paiements.
- Un paiement peut être réparti entre plusieurs factures au moyen de `PaymentAllocation`.
- Le solde est calculé à partir du montant facturé et des allocations de paiements valides.
- Les montants sont stockés en Decimal, jamais en nombres flottants.
- Les numéros de reçus doivent être uniques.
- Les annulations doivent être tracées ; éviter la suppression physique des transactions.
- Le service métier devra vérifier les montants, les allocations, les autorisations et les transactions concurrentes dans une transaction de base de données.

## Implémentation du prototype
- Les types de frais sont administrés par `GET`/`POST /api/v1/fee-types` et `PATCH /api/v1/fee-types/:id` ; les types déjà utilisés sont archivés plutôt que supprimés.
- Les factures sont liées à un élève, un type de frais et une année scolaire (`GET`/`POST /api/v1/invoices`). Le montant est conservé et calculé avec `Decimal`.
- Les échéances d’une facture se créent avec `POST /api/v1/invoices/:id/installments`. Leur somme planifiée ne peut dépasser le montant facturé.
- `POST /api/v1/payments` exige que la somme des allocations soit égale au paiement, bloque les surpaiements et crée paiement et répartitions en transaction sérialisable.
- `GET /api/v1/billing/summary` et `GET /api/v1/invoices` calculent les soldes à partir des allocations des seuls paiements enregistrés.
- `POST /api/v1/payments/:id/cancel` conserve le reçu et les allocations, change le statut et exige un motif ; le paiement annulé cesse de réduire les soldes.
- `GET /api/v1/payments/:id/receipt` fournit les données du reçu. L’interface peut l’afficher et lancer son impression.
- Les catégories de dépenses se gèrent avec `GET`/`POST /api/v1/expense-categories` et `PATCH /api/v1/expense-categories/:id` ; les catégories liées à des écritures sont archivées.
- `POST /api/v1/expenses` enregistre une dépense Decimal dans une année scolaire et vérifie que sa date est dans la période scolaire ; `POST /api/v1/expenses/:id/cancel` enregistre un motif sans supprimer l’écriture.
- `GET /api/v1/expenses` filtre le journal par année, catégorie et dates ; `GET /api/v1/finance/report` agrège les recettes encaissées, les dépenses non annulées, les répartitions et les totaux mensuels.
- Moyens d’encaissement reconnus par l’API : espèces, virement, chèque, Airtel Money, Moov Money, Zamani Cash, Western Union et MoneyGram. Pour les paiements mobiles et agences, la référence du reçu/SMS peut être enregistrée dans `providerReference`.

Les noms disponibles sont basés sur les services publiés au Niger par [Airtel Niger](https://www.airtel.ne/), [Moov Africa Niger](https://www.moov-africa.ne/moov-money/), [Zamani Cash](https://www.zamanitelecom.com/zamani-cash/), [Western Union Niger](https://www.westernunion.com/ne/en/find-locations.html) et [MoneyGram Niger](https://www.moneygram.com/locations/ne/en). Le formulaire enregistre un paiement déjà encaissé ; il ne déclenche pas de transfert, d’API opérateur ou de transaction mobile money.

Les routes financières passent par le middleware d’authentification global : un jeton école valide est requis, puis les permissions du module Finance sont vérifiées selon le rôle. Cette protection est une base applicative, pas une certification de production. Avant un usage réel, il faut encore valider les autorisations et l’isolation multi-établissements, les sauvegardes, la gestion des opérations concurrentes et les procédures de rapprochement.

Les moyens de paiement mobiles et de transfert sont saisis après encaissement. Aucune API Nita, Amana, Wave ou autre opérateur n’est intégrée; aucune transaction n’est déclenchée ou confirmée par l’application.
