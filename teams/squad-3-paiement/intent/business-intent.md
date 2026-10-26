---
id: squad-3-paiement/business-intent
register: intent
level: team
owner: michael.galmiche
status: active
version: 1.0.0
last-validated: 2026-10-26
consumption-mode: context-injection
consumes: [programme/late-checkout/knowledge/brief.md@1.1.0, programme/late-checkout/knowledge/regles-metier.md@1.0.0, programme/late-checkout/knowledge/decisions-deja-prises.md@1.0.0, programme/late-checkout/knowledge/hotels-pilotes.md@1.0.0, teams/squad-1-offre/contracts/offre-api.md@0.1.0, teams/squad-2-prix/contracts/regle-prix.md@0.1.0, teams/squad-2-prix/contracts/kpi.md@0.1.0, org/contracts/security.md@1.0.0]
---

# Business Intent Spec · Paiement du supplément late check-out · G1 Ready to Spec

> Les 5 champs sont une hypothèse de travail (non figée au TOM). Chaque affirmation est **datée et sourcée**, avec l'une de ces quatre étiquettes :
> - **[Nexus : chemin du fichier]** : un fait, une règle ou une décision déjà prise, trouvé dans le Context Nexus (brief, règles métier, `decisions-deja-prises.md`, contrats) ;
> - **[Direction Revenu Annexe, date]** : son ambition chiffrée, l'horizon, la priorité. Ce sont ses décisions pour ce projet : on va les lui demander ;
> - **[Décision de la squad]** : ce que la squad choisit et signe (son seuil de succès engagé, l'owner, ce qu'on ne fait pas) ;
> - **[À confirmer : qui peut répondre]** : ce que personne n'a encore, jamais inventé.

## 1. Problème

- Les clients demandent souvent à partir plus tard ; les hôtels l'accordent à la réception, au cas par cas, ce qui fait du revenu perdu et de la friction. La Direction veut le vendre en ligne après la réservation, sur le site et dans l'app, pour augmenter le revenu annexe. [Nexus : programme/late-checkout/knowledge/brief.md, reçu le 2026-10-21]
- Aujourd'hui, aucune solution de vente en ligne du late check-out n'existe chez Vélora : la réception l'accorde à la main, sans trace, donc sans encaissement. [Nexus : programme/late-checkout/knowledge/decisions-deja-prises.md]
- Le problème propre au volet Paiement : encaisser le supplément de façon fiable, au montant exact affiché, soit en ligne (débit immédiat PayVel), soit à l'hôtel (ajout à la note de chambre), sans faire entrer de donnée de carte dans nos services. [Nexus : programme/late-checkout/knowledge/regles-metier.md (RM-06) ; programme/late-checkout/knowledge/decisions-deja-prises.md (« Prix affiché ») ; org/contracts/security.md]

## 2. Utilisateurs et parties prenantes

- **Client final** d'une réservation confirmée dans un des 5 hôtels pilotes : paie en ligne ou à l'hôtel. [Nexus : programme/late-checkout/knowledge/regles-metier.md (RM-02, RM-06) ; programme/late-checkout/knowledge/hotels-pilotes.md]
- **Réception des hôtels pilotes** : voit le supplément sur la note de chambre (`AT_HOTEL`), rembourse à la main si le remboursement en ligne est reporté en v2, et peut toujours accorder un LCO gratuit (RM-08). [Nexus : programme/late-checkout/knowledge/decisions-deja-prises.md ; programme/late-checkout/knowledge/regles-metier.md]
- **Direction Revenu Annexe** : commanditaire, valide la règle de prix côté métier. [Nexus : programme/late-checkout/knowledge/decisions-deja-prises.md]
- **PSP fictif PayVel** : seul à recevoir la carte ; nous ne recevons qu'un `paymentToken`. [Nexus : teams/squad-3-paiement/contracts/contraintes-pci.md (PCI-01)]
- **Autres squads** : Offre (fournit `offerId` et `priceMinor` du créneau), Prix (bornes de prix), Expérience (appelle notre API et émet les événements d'achat). [Nexus : teams/squad-1-offre/contracts/offre-api.md@0.1.0 ; teams/squad-2-prix/contracts/regle-prix.md@0.1.0 ; teams/squad-3-paiement/contracts/paiement-api.md@0.1.0]
- **Security guild** : garante du périmètre PCI-DSS (SEC-01 à SEC-05). [Nexus : org/contracts/security.md]

## 3. Critère de succès chiffré

- KPI du programme, seuils « à fixer en G1 » : `attach_rate`, `lco_revenue_per_eligible`, `tile_to_purchase`. [Nexus : teams/squad-2-prix/contracts/kpi.md@0.1.0]
- `online_share` et `reception_override_rate` sont suivis **sans seuil** : on ne juge pas dessus. [Nexus : programme/late-checkout/knowledge/decisions-deja-prises.md]
- Ambition chiffrée du pilote : `lco_revenue_per_eligible` ≥ **300 centimes** (3,00 €) par réservation éligible, mesuré sur les **30 jours qui suivent l'activation**, sur les **5 hôtels pilotes**. [Direction Revenu Annexe, 2026-10-26]
- Seuil engagé par la squad Paiement : au moins **93 %** des paiements tentés aboutissent (`CAPTURED` ou `POSTED_TO_FOLIO`), en ligne et à l'hôtel, sur la même période de 30 jours. [Décision de la squad, 2026-10-26]
- Taux d'échec réel des paiements aujourd'hui : [À confirmer : personne aujourd'hui]

## 4. Données

| Donnée | Source | Disponibilité |
|---|---|---|
| Prix du créneau (`options[].priceMinor`, centimes) pour recalculer le montant (SEC-05) | API d'offre, squad Offre [Nexus : teams/squad-1-offre/contracts/offre-api.md@0.1.0] | **disponible** en mock v0 (`src/mocks/`), v1 attendue avant G2 |
| Bornes de prix (plancher, plafond) | squad Prix [Nexus : teams/squad-2-prix/contracts/regle-prix.md@0.1.0] | **disponible** en v0, v1 attendue avant 14:55 (jalon M1) |
| Réservations (statut, LCO déjà acheté, devise EUR) | données synthétiques du starter (`data/reservations.json`) | **disponible** |
| Jeton de paiement PayVel | composant `VelaPaymentSheet`, squad Expérience [Nexus : teams/squad-3-paiement/contracts/contraintes-pci.md] | **à acquérir** : mock PayVel à fournir par notre squad (API-05) |
| Taux d'échec réel des paiements | — | **bloquée** [À confirmer : personne aujourd'hui] |
| Volume de LCO gratuits accordés aujourd'hui | — | **bloquée** : c'est ce que le pilote mesurera [Nexus : programme/late-checkout/knowledge/decisions-deja-prises.md] |
| Nombre de réservations éligibles par jour | — | [À confirmer : l'expert Data] |

Aucune donnée de carte (numéro, CVV, date d'expiration) n'est manipulée. [Nexus : org/contracts/security.md (SEC-01)]

## 5. Priorité et owner

- Priorité du pilote : **priorité du trimestre**, car le revenu se perd aujourd'hui à la réception, sans trace. [Direction Revenu Annexe, 2026-10-26]
- Remboursement (RM-04) : dans le pilote, mais acceptable en v2 si le temps manque, la réception rembourse alors à la main. [Nexus : programme/late-checkout/knowledge/decisions-deja-prises.md] Choix de la squad : le remboursement en ligne est **reporté en v2** ; pendant le pilote, la réception rembourse à la main. [Décision de la squad, 2026-10-26]
- Paiement en ligne refusé : proposer « Payer à l'hôtel ». [Nexus : programme/late-checkout/knowledge/decisions-deja-prises.md]
- Prix changé entre affichage et paiement : refuser et renvoyer vers une offre à jour (`409 LCO_AMOUNT_MISMATCH`). [Nexus : programme/late-checkout/knowledge/decisions-deja-prises.md ; teams/squad-3-paiement/contracts/paiement-api.md@0.1.0]
- Ce qu'on ne fait pas : pas de saisie ni de stockage de carte (PCI-01), pas d'appel PayVel en mode `AT_HOTEL` (PCI-04), pas d'autre devise que l'EUR (RM-07). [Nexus : teams/squad-3-paiement/contracts/contraintes-pci.md ; programme/late-checkout/knowledge/regles-metier.md] Le remboursement en ligne n'est pas livré dans cette version. [Décision de la squad, 2026-10-26]
- Owner de cette intention : Michael Galmiche (`michael.galmiche`), signée le 2026-10-26. [Décision de la squad]

## Réutilisation

Aucune solution de vente en ligne du late check-out n'existe chez Vélora ; l'ancien processus (accord manuel à la réception, sans trace) est celui que le pilote remplace. [Nexus : programme/late-checkout/knowledge/decisions-deja-prises.md] Le paiement réutilise le PSP existant PayVel et son composant `VelaPaymentSheet`, plutôt que de construire une saisie de carte. [Nexus : teams/squad-3-paiement/contracts/contraintes-pci.md]

## Dépendances vers les autres squads

| Ce dont on a besoin | Squad | Contrat (version lue) | Question ouverte |
|---|---|---|---|
| `offerId`, `options[].priceMinor` et `expiresAt` pour recalculer le montant et refuser une offre expirée | squad-1-offre | `offre-api.md@0.1.0` | Comment interroger l'offre côté serveur au moment du paiement (même endpoint ou endpoint interne) ? |
| Bornes de prix | squad-2-prix | `regle-prix.md@0.1.0` | Faut-il revérifier les bornes au paiement, ou l'offre suffit-elle ? |
| `paymentToken` issu de `VelaPaymentSheet`, appel de notre API, événement `purchase_completed` | squad-4-experience | `evenements-achat.md@0.1.0`, `ecrans.md@0.1.0` | Qui émet `purchase_completed` : Expérience après notre `201`, ou nous ? |
