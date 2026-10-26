---
id: squad-4-experience/business-intent
register: intent
level: team
owner: william.demirci
status: active
version: 1.0.0
last-validated: 2026-10-26
consumption-mode: context-injection
consumes: [programme/late-checkout/knowledge/brief.md@1.1.0, programme/late-checkout/knowledge/regles-metier.md@1.0.0, programme/late-checkout/knowledge/decisions-deja-prises.md@1.0.0, programme/late-checkout/knowledge/hotels-pilotes.md@1.0.0, programme/late-checkout/contracts/composants-ui.md@1.0.0, teams/squad-1-offre/contracts/offre-api.md@0.1.0, teams/squad-3-paiement/contracts/paiement-api.md@0.1.0, teams/squad-2-prix/contracts/kpi.md@0.1.0]
---

# Business Intent Spec · Expérience (tuile « Gérer ma réservation » et carte de late check-out) · G1 Ready to Spec

> Les 5 champs sont une hypothèse de travail (non figée au TOM). Chaque affirmation est **datée et sourcée**, avec l'une de ces quatre étiquettes :
> - **[Nexus : chemin du fichier]** : un fait, une règle ou une décision déjà prise, trouvé dans le Context Nexus (brief, règles métier, `decisions-deja-prises.md`, contrats) ;
> - **[Direction Revenu Annexe, date]** : son ambition chiffrée, l'horizon, la priorité. Ce sont ses décisions pour ce projet : on va les lui demander ;
> - **[Décision de la squad]** : ce que la squad choisit et signe (son seuil de succès engagé, l'owner, ce qu'on ne fait pas) ;
> - **[À confirmer : qui peut répondre]** : ce que personne n'a encore, jamais inventé.

## 1. Problème
- Les clients demandent souvent à partir plus tard ; les hôtels l'accordent à la réception, au cas par cas, ce qui fait perdre du revenu et crée de la friction. [Nexus : programme/late-checkout/knowledge/brief.md, reçu le 2026-10-21]
- Aucune solution de vente du late check-out en ligne n'existe chez Vélora : la réception l'accorde à la main, sans trace. [Nexus : programme/late-checkout/knowledge/decisions-deja-prises.md]
- Pour le volet Expérience : après sa réservation, le client n'a aucun point d'entrée sur le site ou dans l'app pour découvrir, choisir et payer un départ tardif. [Nexus : programme/late-checkout/knowledge/brief.md ; programme/late-checkout/knowledge/glossaire.md, « Tuile Gérer ma réservation »]
- Volume actuel de LCO accordés gratuitement : inconnu, c'est ce que le pilote mesurera (`reception_override_rate`). [À confirmer : personne aujourd'hui, cf. programme/late-checkout/knowledge/decisions-deja-prises.md]

## 2. Utilisateurs et parties prenantes
- Client final ayant une réservation confirmée dans l'un des 5 hôtels pilotes, sur le site ou dans l'app (iOS, Android). [Nexus : programme/late-checkout/knowledge/brief.md ; programme/late-checkout/knowledge/hotels-pilotes.md]
- Clients utilisant un lecteur d'écran : tout prix affiché est lu en toutes lettres (montant + devise). [Nexus : org/contracts/accessibility.md, A11Y-03 ; programme/late-checkout/knowledge/decisions-deja-prises.md]
- Réception des hôtels pilotes : peut toujours accorder un LCO gratuit pendant le pilote (RM-08). [Nexus : programme/late-checkout/knowledge/regles-metier.md]
- Direction Revenu Annexe : commanditaire, valide la règle de prix côté métier. [Nexus : programme/late-checkout/knowledge/brief.md ; programme/late-checkout/knowledge/decisions-deja-prises.md]
- Autres squads : Offre (éligibilité et prix, `offre-api`), Paiement (encaissement, `paiement-api`), Prix (KPI alimentés par nos événements, `kpi`). [Nexus : teams/squad-2-prix/contracts/kpi.md]

## 3. Critère de succès chiffré
- KPI candidats, définis par la squad Prix, dont les seuils sont « à fixer en G1 » [Nexus : teams/squad-2-prix/contracts/kpi.md] :
  - `tile_to_purchase` = `purchase_completed` / `tile_viewed` : mesure directe de l'efficacité de nos écrans ;
  - `attach_rate` = réservations ayant acheté un LCO / réservations éligibles.
- `online_share` et `reception_override_rate` sont suivis, sans seuil. [Nexus : programme/late-checkout/knowledge/decisions-deja-prises.md]
- Ambition du pilote : 10 000 clients acheteurs d'un LCO, pour un supplément moyen de 35,00 € par client (`amount_minor` moyen = 3500), soit environ 350 000 € de revenu annexe. [Direction Revenu Annexe, 2026-10-26]
- Horizon de mesure : la première année. [Direction Revenu Annexe, 2026-10-26]
- 35,00 € se situe entre le plancher et le plafond de la règle de prix v0 (2 500 à 4 500 centimes selon la tranche). [Nexus : teams/squad-2-prix/contracts/regle-prix.md]
- Les 35,00 € s'entendent par client qui achète un LCO, et non par réservation éligible. [Direction Revenu Annexe, 2026-10-26]
- **Seuil engagé** : 85 % de l'ambition, soit ≥ 297 500 € de revenu LCO (somme des `purchase_completed.amount_minor` ≥ 29 750 000 centimes, l'équivalent de 8 500 acheteurs à 35,00 €), à 12 mois après l'ouverture du pilote. [Décision de la squad, 2026-10-26]

## 4. Données

| Donnée | Source | Disponibilité |
|---|---|---|
| Éligibilité, créneaux et prix TTC en centimes (`eligible`, `reasons`, `options[]`) | teams/squad-1-offre/contracts/offre-api.md v0.1.0, mock du starter | disponible (v0 ; v1 attendue avant G2) |
| Résultat du paiement (`CAPTURED`, `POSTED_TO_FOLIO`, erreurs 402 et 409) | teams/squad-3-paiement/contracts/paiement-api.md v0.1.0, mock du starter | disponible (v0 ; v1 attendue avant G2) |
| Hôtels pilotes, horaires, fuseau | programme/late-checkout/knowledge/hotels-pilotes.md | disponible |
| Réservations et occupation prévue synthétiques | données fictives du starter | disponible (jeux complets remis le jour J) |
| Événements d'achat (`tile_viewed` … `purchase_failed`) | teams/squad-4-experience/contracts/evenements-achat.md v0.1.0 | à acquérir : émis par nos écrans, v1 à publier avant 15:05 (jalon M2) |
| Nombre de réservations éligibles par jour | — | [À confirmer : l'expert Data] |
| Taux d'échec réel des paiements | — | [À confirmer : personne aujourd'hui] |

Source des lignes « À confirmer » : [Nexus : programme/late-checkout/knowledge/decisions-deja-prises.md]

## 5. Priorité et owner
- Pilote sur 5 hôtels, données 100 % synthétiques. [Nexus : programme/late-checkout/knowledge/brief.md]
- Une seule plateforme implémentée pendant le pilote, au choix de notre squad ; les autres sont spécifiées. [Nexus : programme/late-checkout/knowledge/decisions-deja-prises.md] Plateforme implémentée : Android ; web et iOS sont spécifiés, non implémentés. [Décision de la squad, 2026-10-26]
- Remboursement (RM-04) acceptable en v2 si le temps manque. [Nexus : programme/late-checkout/knowledge/decisions-deja-prises.md]
- Priorité du pilote : moyenne. [Direction Revenu Annexe, 2026-10-26]
- « Pourquoi maintenant » : [À confirmer : Direction Revenu Annexe]
- Ce qu'on ne fait pas : rien n'est exclu du périmètre Expérience, remboursement (RM-04) compris. [Décision de la squad, 2026-10-26]
- Owner de cette intention : William Demirci, signée le 2026-10-26 après relecture en squad. [Décision de la squad, 2026-10-26]

## Réutilisation
- Aucune solution de vente du LCO en ligne n'existe chez Vélora. [Nexus : programme/late-checkout/knowledge/decisions-deja-prises.md]
- On réutilise le design system Vela DS (`VelaTile`, `VelaCard`, `VelaSlotPicker`, `VelaPaymentSheet`, `VelaToast`) et son format de prix 25,00 €. [Nexus : programme/late-checkout/contracts/composants-ui.md]
- On réutilise la tuile « Gérer ma réservation », point d'entrée existant vers les services additionnels. [Nexus : programme/late-checkout/knowledge/glossaire.md]

## Dépendances vers les autres squads
| Ce dont on a besoin | Squad | Contrat (version lue) | Question ouverte |
|---|---|---|---|
| Éligibilité, motifs, créneaux et prix TTC | Offre | teams/squad-1-offre/contracts/offre-api.md @0.1.0 | Date de la v1 et du mock (API-05) |
| Paiement en ligne ou à l'hôtel, erreurs 402 et 409 | Paiement | teams/squad-3-paiement/contracts/paiement-api.md @0.1.0 | Date de la v1 ; remboursement en v1 ou en v2 ? |
| Seuils des KPI alimentés par nos événements | Prix | teams/squad-2-prix/contracts/kpi.md @0.1.0 | Quel KPI porte notre critère de succès ? |
| Composants d'écran et format de prix | Programme | programme/late-checkout/contracts/composants-ui.md @1.0.0 | — |
