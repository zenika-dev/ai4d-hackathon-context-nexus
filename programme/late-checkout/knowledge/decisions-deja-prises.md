---
id: programme/decisions-deja-prises
register: knowledge
level: programme
owner: direction-revenu-annexe
status: active
version: 1.0.0
last-validated: 2026-10-21
consumption-mode: context-injection
---

# Decision Context · ce qui est déjà décidé ou connu pour le pilote

> La mémoire des décisions prises avant le projet, et des faits connus. Ce fichier répond aux questions de fait :
> inutile de les poser à la Direction Revenu Annexe. Citez-le comme source (`programme/late-checkout/knowledge/decisions-deja-prises.md`).
> **Ce qu'il ne contient pas** : l'ambition chiffrée du pilote, son horizon et sa priorité. Ce sont des décisions de la
> Direction Revenu Annexe pour ce projet : allez les lui demander. Et l'engagement de votre squad (seuil signé, owner) est à vous.

## Décisions déjà prises (Direction Revenu Annexe, 2026-10-21)

| Sujet | Décision |
|---|---|
| Prix affiché | TTC, tel que le client le paie. Le montant débité est exactement le montant affiché. |
| Règle de prix | Les bornes du contrat `regle-prix` v0 sont validées pour le pilote. Toute modification passe par une nouvelle version du contrat, annoncée aux squads qui l'utilisent. La Direction Revenu Annexe valide la règle côté métier. |
| Hôtel complet (> 95 %) | Aucun LCO vendu. |
| Prévision d'occupation absente | Aucun LCO vendu : mieux vaut ne pas vendre que vendre mal. |
| Nuit qui compte pour l'occupation | La nuit qui précède le départ (celle que le client prolonge le matin). |
| Donnée manquante pour calculer une offre | Réservation non éligible, avec un motif. |
| Réservation non éligible | La tuile n'apparaît pas ; on ne dit pas pourquoi au client. |
| LCO déjà acheté | Le client voit son heure confirmée (« Départ à 13:00 confirmé »). |
| Prix changé entre affichage et paiement | Refuser, et renvoyer vers une offre à jour. |
| Remboursement (RM-04) | Dans le pilote, mais acceptable en v2 si le temps manque : la réception rembourse alors à la main. |
| Paiement en ligne refusé | Proposer « Payer à l'hôtel ». |
| Offre expirée | Un message, puis retour à la réservation. |
| Affichage du prix | Composants Vela DS, format `25,00 €`, lu en toutes lettres par un lecteur d'écran. |
| Plateformes | Une seule implémentée pendant le pilote (au choix de la squad Expérience) ; les autres sont spécifiées. |
| KPI suivis sans seuil | `online_share` et `reception_override_rate` : on les regarde, on ne juge pas dessus. |

## Faits connus

- La prévision d'occupation est produite par le revenue management, une fois par nuit, à 06:00 heure locale de l'hôtel, pour les 14 jours à venir.
- Pendant le pilote, la réception peut toujours accorder un LCO gratuit à sa discrétion (RM-08).
- Portefeuille : aucune solution de vente du late check-out en ligne n'existe chez Vélora. Aujourd'hui, la réception l'accorde à la main, sans trace : c'est l'ancien processus que le pilote remplace (et que G6 retirera).

## Ce qu'on ne sait pas (à écrire « à confirmer », ne pas inventer)

| Question | Qui peut répondre |
|---|---|
| Le volume actuel de LCO accordés gratuitement | Personne aujourd'hui : c'est ce que le pilote mesurera (`reception_override_rate`) |
| Le nombre de réservations éligibles par jour | L'expert Data |
| Le taux d'échec réel des paiements | Personne aujourd'hui |
