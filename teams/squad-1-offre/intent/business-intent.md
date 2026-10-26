---
id: squad-1-offre/business-intent
register: intent
level: team
owner: orel.elmire
status: active
version: 1.0.0
last-validated: 2026-10-26
consumption-mode: context-injection
consumes: [programme/late-checkout/knowledge/brief.md@1.1.0, programme/late-checkout/knowledge/regles-metier.md@1.0.0, programme/late-checkout/knowledge/decisions-deja-prises.md@1.0.0, programme/late-checkout/knowledge/hotels-pilotes.md@1.0.0, teams/squad-2-prix/contracts/regle-prix.md@0.1.0, teams/squad-2-prix/contracts/kpi.md@0.1.0]
---

# Business Intent Spec · Offre (éligibilité et prix du late check-out) · G1 Ready to Spec

> Les 5 champs sont une hypothèse de travail (non figée au TOM). Chaque affirmation est **datée et sourcée**, avec l'une de ces quatre étiquettes :
> - **[Nexus : chemin du fichier]** : un fait, une règle ou une décision déjà prise, trouvé dans le Context Nexus (brief, règles métier, `decisions-deja-prises.md`, contrats) ;
> - **[Direction Revenu Annexe, date]** : son ambition chiffrée, l'horizon, la priorité. Ce sont ses décisions pour ce projet : on va les lui demander ;
> - **[Décision de la squad]** : ce que la squad choisit et signe (son seuil de succès engagé, l'owner, ce qu'on ne fait pas) ;
> - **[À confirmer : qui peut répondre]** : ce que personne n'a encore, jamais inventé.

## 1. Problème
- Les clients demandent souvent à partir plus tard ; aujourd'hui la réception l'accorde au cas par cas, ce qui fait perdre du revenu et crée de la friction. [Nexus : programme/late-checkout/knowledge/brief.md, reçu le 2026-10-21]
- Ce LCO est accordé à la main, sans trace (FrontDesk Notes) : aucune solution de vente en ligne n'existe chez Vélora. [Nexus : programme/late-checkout/knowledge/decisions-deja-prises.md ; programme/late-checkout/knowledge/glossaire.md]
- Pour le vendre en ligne, il faut d'abord savoir, pour chaque réservation, si elle est éligible, quels créneaux proposer et à quel prix : c'est le volet Offre, qui porte l'éligibilité. [Nexus : programme/late-checkout/knowledge/glossaire.md]
- Le volume actuel de LCO gratuits n'est pas connu. [À confirmer : personne aujourd'hui, le pilote le mesurera via `reception_override_rate`]

## 2. Utilisateurs et parties prenantes
- Client final ayant réservé dans un des 5 hôtels pilotes : il voit l'offre seulement s'il est éligible ; sinon la tuile n'apparaît pas, sans explication. [Nexus : programme/late-checkout/knowledge/decisions-deja-prises.md ; programme/late-checkout/knowledge/hotels-pilotes.md]
- Réception des hôtels pilotes : peut toujours accorder un LCO gratuit pendant le pilote (RM-08). [Nexus : programme/late-checkout/knowledge/regles-metier.md]
- Direction Revenu Annexe : commanditaire, valide la règle de prix côté métier. [Nexus : programme/late-checkout/knowledge/decisions-deja-prises.md]
- Squad Expérience : affiche la tuile et les créneaux à partir de notre réponse (`eligible`, `options[]`). [Nexus : teams/squad-4-experience/contracts/ecrans.md@0.1.0]
- Squad Paiement : débite exactement le `priceMinor` de notre offre pour le créneau choisi. [Nexus : teams/squad-3-paiement/contracts/paiement-api.md@0.1.0]
- Squad Prix : fournit les bornes plancher / plafond ; calcule `attach_rate` à partir de notre API. [Nexus : teams/squad-2-prix/contracts/regle-prix.md@0.1.0 ; teams/squad-2-prix/contracts/kpi.md@0.1.0]

## 3. Critère de succès chiffré
- Métriques candidates déjà définies : `attach_rate` (réservations ayant acheté / réservations éligibles) et `lco_revenue_per_eligible` (en centimes) ; seuils « à fixer en G1 ». [Nexus : teams/squad-2-prix/contracts/kpi.md@0.1.0]
- `online_share` et `reception_override_rate` sont suivis sans seuil. [Nexus : programme/late-checkout/knowledge/decisions-deja-prises.md]
- Ambition : `attach_rate` de 8 % des réservations éligibles ; en dessous de 5 %, le pilote n'a pas d'intérêt. [Direction Revenu Annexe, 2026-10-26]
- Horizon de mesure : 30 jours après l'activation, sur les 5 hôtels pilotes. [Direction Revenu Annexe, 2026-10-26]
- **Critère de succès engagé** : `attach_rate` ≥ 5 % des réservations éligibles, 30 jours après l'activation, sur les 5 hôtels pilotes ; ambition visée : 8 %. [Décision de la squad, signée par Orel Elmire le 2026-10-26]

## 4. Données

| Donnée | Source | Date | Disponibilité |
|---|---|---|---|
| Hôtels pilotes, départ standard, heure limite, créneaux, fuseau Europe/Paris | programme/late-checkout/knowledge/hotels-pilotes.md ; data/hotels.json | 2026-10-21 | disponible [Nexus : programme/late-checkout/knowledge/hotels-pilotes.md] |
| Réservations (statut, nuits, LCO déjà acheté) | data/reservations.json (6 réservations synthétiques) | starter | disponible (jeu de test) |
| Occupation prévue par hôtel et par nuit | revenue management, 1 fois par nuit à 06:00 locale, 14 jours à venir ; data/occupation-prevue.json (1er au 7 nov. 2026) | quotidienne | disponible pour le pilote [Nexus : programme/late-checkout/knowledge/decisions-deja-prises.md] |
| Bornes de prix par tranche d'occupation | contrat regle-prix v0, validé pour le pilote | 2026-10-23 | disponible, v1 attendue avant 14:55 (M1) [Nexus : teams/squad-2-prix/contracts/regle-prix.md@0.1.0] |
| Nombre de réservations éligibles par jour | — | — | à acquérir [À confirmer : l'expert Data] |

Règles de traitement déjà décidées : prévision d'occupation absente → aucun LCO vendu ; donnée manquante → non éligible avec un motif ; nuit qui compte = celle qui précède le départ. [Nexus : programme/late-checkout/knowledge/decisions-deja-prises.md]

## 5. Priorité et owner
- Pourquoi maintenant : le revenu se perd aujourd'hui à la réception, sans trace ; c'est la priorité du trimestre. [Direction Revenu Annexe, 2026-10-26]
- Hors périmètre du pilote : les autres services annexes et les hôtels hors des 5 hôtels pilotes. [Direction Revenu Annexe, 2026-10-26]
- MVP du volet Offre : l'API `GET /v1/reservations/{reservationId}/late-checkout-offer` (éligibilité RM-01 à RM-04 avec motifs, créneaux RM-03, prix selon `regle-prix`), derrière un flag désactivé, et son mock pour les autres squads (API-05). [Décision de la squad, signée par Orel Elmire le 2026-10-26]
- Ce que la squad ne fait pas : le remboursement (acceptable en v2, la réception rembourse à la main) [Nexus : programme/late-checkout/knowledge/decisions-deja-prises.md] ; l'encaissement et l'affichage (squads Paiement et Expérience) ; tout prix qui dépendrait du profil client (RM-05) ; une autre devise que l'EUR (RM-07). [Décision de la squad, signée par Orel Elmire le 2026-10-26]
- Owner de cette intention : orel.elmire [Décision de la squad, 2026-10-26]

## Réutilisation
Aucune solution existante : la vente du LCO en ligne n'existe pas chez Vélora, seul l'ancien processus manuel à la réception existe (que G6 retirera). Les autres squads consomment notre offre sans la recalculer. [Nexus : programme/late-checkout/knowledge/decisions-deja-prises.md ; teams/squad-3-paiement/contracts/paiement-api.md@0.1.0]

## Dépendances vers les autres squads
| Ce dont on a besoin | Squad | Contrat (version lue) | Question ouverte |
|---|---|---|---|
| Bornes plancher / plafond par tranche, comportement si prévision absente | Prix | regle-prix.md@0.1.0 | Source et date de la prévision, mock (v1 avant 14:55) |
| Aucun besoin entrant ; ils consomment `eligible`, `reasons`, `options[]` | Expérience | ecrans.md@0.1.0 | Le sous-titre « dès 15,00 € » suppose de connaître le prix plancher |
| Aucun besoin entrant ; ils consomment `offerId`, `priceMinor` | Paiement | paiement-api.md@0.1.0 | Durée de validité de `offerId` au-delà de `expiresAt` |
