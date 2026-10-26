---
id: squad-2-prix/business-intent
register: intent
level: team
owner: clemence.mathieux
status: active
version: 1.0.0
last-validated: 2026-10-26
consumption-mode: context-injection
consumes: [programme/late-checkout/knowledge/brief.md@1.1.0, programme/late-checkout/knowledge/regles-metier.md@1.0.0, programme/late-checkout/knowledge/decisions-deja-prises.md@1.0.0, programme/late-checkout/knowledge/hotels-pilotes.md@1.0.0, teams/squad-2-prix/contracts/regle-prix.md@0.1.0, teams/squad-2-prix/contracts/kpi.md@0.1.0, teams/squad-1-offre/contracts/offre-api.md@0.1.0, teams/squad-3-paiement/contracts/paiement-api.md@0.1.0, teams/squad-4-experience/contracts/evenements-achat.md@0.1.0]
---

# Business Intent Spec · Prix · G1 Ready to Spec

> Brouillon proposé par l'agent le 2026-10-26, à relire, compléter et signer par la squad.
> Les 5 champs sont une hypothèse de travail (non figée au TOM). Chaque affirmation est **datée et sourcée**, avec l'une de ces quatre étiquettes :
> - **[Nexus : chemin du fichier]** : un fait, une règle ou une décision déjà prise, trouvé dans le Context Nexus ;
> - **[Direction Revenu Annexe, date]** : son ambition chiffrée, l'horizon, la priorité ;
> - **[Décision de la squad]** : ce que la squad choisit et signe ;
> - **[À confirmer : qui peut répondre]** : ce que personne n'a encore, jamais inventé.

## 1. Problème

- Les clients demandent souvent à partir plus tard ; la réception l'accorde au cas par cas, gratuitement : du revenu perdu et de la friction. **[Nexus : programme/late-checkout/knowledge/brief.md, reçu le 2026-10-21]**
- L'accord se fait à la main, sans trace : aucun prix, aucune mesure. **[Nexus : programme/late-checkout/knowledge/decisions-deja-prises.md, « Faits connus »]**
- Pour le volet Prix : il faut un supplément par créneau qui varie avec l'occupation prévue (vendre plus cher quand l'hôtel est plein, ne pas vendre au-delà de 95 %), borné par un plancher et un plafond, et identique pour tous les clients. **[Nexus : teams/squad-2-prix/contracts/regle-prix.md v0.1.0]** **[Nexus : programme/late-checkout/knowledge/regles-metier.md, RM-05]**
- Volume actuel de LCO gratuits accordés : **[À confirmer : personne aujourd'hui, le pilote le mesurera via `reception_override_rate`]**

## 2. Utilisateurs et parties prenantes

| Qui | Ce qu'il attend du volet Prix | Source |
|---|---|---|
| Client final (web, iOS, Android) | Un prix TTC clair, exactement celui débité, qui ne dépend pas de son profil | [Nexus : decisions-deja-prises.md] [Nexus : regles-metier.md, RM-05] |
| Direction Revenu Annexe | Augmenter le revenu annexe ; valide la règle de prix côté métier | [Nexus : brief.md] [Nexus : decisions-deja-prises.md, « Règle de prix »] |
| Revenue management | Produit la prévision d'occupation (06:00 locale, 14 jours) | [Nexus : decisions-deja-prises.md, « Faits connus »] |
| Réception des 5 hôtels pilotes | Peut toujours accorder un LCO gratuit (RM-08) | [Nexus : regles-metier.md, RM-08] |
| Squad Offre | Consomme les bornes pour calculer `options[].priceMinor` | [Nexus : teams/squad-2-prix/contracts/regle-prix.md, `consumers`] |
| Squad Paiement | Consomme les bornes pour recalculer le montant débité (SEC-05) | [Nexus : regle-prix.md, `consumers`] |
| Squad Expérience | Émet les événements qui alimentent nos KPI | [Nexus : teams/squad-4-experience/contracts/evenements-achat.md v0.1.0] |

## 3. Critère de succès chiffré

| KPI | Définition | Seuil | Horizon | Fixé par |
|---|---|---|---|---|
| `lco_revenue_per_eligible` (**critère principal**) | somme des suppléments / réservations éligibles, en centimes | **≥ 300** (3,00 € par réservation éligible) | 30 jours après l'activation du flag, sur les 5 hôtels pilotes | [Direction Revenu Annexe, 2026-10-26] |
| `attach_rate` | réservations ayant acheté un LCO / réservations éligibles | cible **8 %** ; en dessous de **5 %**, le pilote n'a pas d'intérêt | idem | [Direction Revenu Annexe, 2026-10-26] |
| Seuil engagé par la squad | réservations ayant acheté un LCO / réservations éligibles | **`attach_rate` ≥ 8 %**, avec `lco_revenue_per_eligible` ≥ 300 centimes | 30 jours après l'activation, 5 hôtels pilotes | [Décision de la squad, signée par Clemence Mathieux le 2026-10-26] |
| `online_share`, `reception_override_rate` | voir `kpi.md` | suivi, sans seuil | — | [Nexus : decisions-deja-prises.md] |

Définitions : **[Nexus : teams/squad-2-prix/contracts/kpi.md v0.1.0]**.

## 4. Données

| Donnée | Source | Disponibilité |
|---|---|---|
| Occupation prévue par hôtel et par nuit (nuit qui précède le départ) | Revenue management, 06:00 locale, 14 jours ; échantillon synthétique `data/occupation-prevue.json` du starter | **disponible** (échantillon) ; jeu complet remis le jour J [Nexus : decisions-deja-prises.md] |
| Bornes par tranche d'occupation | `regle-prix.md` v0.1.0, validées pour le pilote | **disponible** [Nexus : decisions-deja-prises.md, « Règle de prix »] |
| Hôtels pilotes, départ standard, heure limite, créneaux | `hotels-pilotes.md` v1.0.0 | **disponible** |
| Événements d'achat (`purchase_completed.amount_minor`…) | Squad Expérience, `evenements-achat.md` v0.1.0 ; échantillon `data/purchase-events.json` | **disponible** (échantillon synthétique) |
| Nombre de réservations éligibles par jour | — | **à acquérir** [À confirmer : l'expert Data] |
| Volume actuel de LCO gratuits | — | **bloquée** [À confirmer : personne, mesuré par le pilote] |

Règle si la prévision est absente : aucun LCO vendu. **[Nexus : decisions-deja-prises.md]**

## 5. Priorité et owner

- Pourquoi maintenant : augmenter le revenu annexe en vendant en ligne ce que la réception accorde aujourd'hui gratuitement. **[Nexus : programme/late-checkout/knowledge/brief.md]**
- Priorité du pilote : **le revenu**, avant l'adoption. En cas d'arbitrage, `lco_revenue_per_eligible` prime sur `attach_rate`. **[Direction Revenu Annexe, 2026-10-26]**
- Ce qu'on ne fait pas (proposition à valider) : pas de prix personnalisé selon le profil client **[Nexus : regles-metier.md, RM-05]** ; pas d'autre devise que l'EUR **[Nexus : regles-metier.md, RM-07]** ; pas de modification des bornes sans nouvelle version du contrat **[Nexus : decisions-deja-prises.md]** ; autres exclusions **[Décision de la squad]**
- Owner de l'intention : **Clemence Mathieux**, signature du 2026-10-26, pour le compte de la Direction Revenu Annexe (commanditaire). [Décision de la squad]

## Réutilisation

Aucune solution de vente du late check-out en ligne n'existe chez Vélora ; seul l'ancien processus manuel à la réception, sans trace, que le pilote remplace. **[Nexus : decisions-deja-prises.md, « Faits connus »]**
Réutilisé : la règle de prix v0 (bornes déjà validées pour le pilote) et la prévision d'occupation existante du revenue management.

## Dépendances vers les autres squads

| Ce dont on a besoin | Squad | Contrat (version lue) | Question ouverte |
|---|---|---|---|
| Que l'Offre calcule `priceMinor` avec notre formule et nos bornes | squad-1-offre | `offre-api.md` 0.1.0 | Qui applique la formule par créneau : Offre, ou une route Prix ? |
| Que le Paiement recalcule le montant côté serveur (SEC-05) | squad-3-paiement | `paiement-api.md` 0.1.0 | Appelle-t-il nos bornes ou l'offre ? |
| Les événements `purchase_completed` avec `amount_minor`, `mode` | squad-4-experience | `evenements-achat.md` 0.1.0 | Plateforme implémentée pour le pilote ? |
