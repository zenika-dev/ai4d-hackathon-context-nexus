---
id: squad-2-prix/regle-prix
register: contracts
level: team
owner: clemence.mathieux
status: active
version: 1.0.0
last-validated: 2026-10-26
consumption-mode: context-injection
consumes: [programme/late-checkout/knowledge/hotels-pilotes.md@1.0.0, programme/late-checkout/knowledge/decisions-deja-prises.md@1.0.0, programme/late-checkout/knowledge/regles-metier.md@1.0.0]
consumers: [squad-1-offre, squad-3-paiement]
exception-to: null
exception-approved-by: null
---

# Règle de prix · plancher et plafond · v1

> Proposé par l'agent le 2026-10-26, signé par Clemence Mathieux (squad Prix) le 2026-10-26 (validation métier : Direction Revenu Annexe).
> Remplace la v0.1.0. Version **majeure** (API-03) : le sens du paramètre `date` est précisé et les cas « pas de LCO » deviennent des erreurs explicites.
> Étiquettes : **[Nexus : …]** fait ou décision déjà prise ; **[Décision de la squad]** proposition à valider ; **[À confirmer : …]**.

## Principe

Le supplément d'un créneau LCO est borné par un plancher et un plafond qui dépendent de l'**occupation prévue**
de l'hôtel pour la **nuit qui précède le départ** (celle que le client prolonge le matin). **[Nexus : decisions-deja-prises.md]**
Il ne dépend jamais du profil du client. **[Nexus : regles-metier.md, RM-05]**

## Source de la prévision d'occupation

| Élément | Valeur | Source |
|---|---|---|
| Producteur | Revenue management | [Nexus : decisions-deja-prises.md, « Faits connus »] |
| Fréquence | Une fois par nuit, à 06:00 heure locale de l'hôtel (`Europe/Paris`), pour les 14 jours à venir | [Nexus : decisions-deja-prises.md] |
| Donnée utilisée | `occupancyRate` (entier, en %) de la nuit `date − 1 jour` | [Nexus : decisions-deja-prises.md] |
| Version retenue | La dernière prévision publiée au moment de l'appel ; sa date est renvoyée dans `forecastGeneratedAt` | [Décision de la squad] |
| Pilote (dry run) | Échantillon synthétique `data/occupation-prevue.json` du starter | [Nexus : business-intent.md, champ 4] |

## Bornes par tranche d'occupation prévue

Tous les montants sont des **entiers en centimes** de la devise de la réservation (`1500` = 15,00 €). Devise : `EUR` uniquement (RM-07).
Bornes validées pour le pilote, inchangées depuis la v0. **[Nexus : decisions-deja-prises.md, « Règle de prix »]**

| Tranche | Occupation prévue (`occupancyRate`, entier) | `floorMinor` | `ceilingMinor` |
|---|---|---|---|
| BASSE | 0 à 59 | 1500 | 3000 |
| MOYENNE | 60 à 85 (inclus) | 2500 | 4500 |
| HAUTE | 86 à 95 (inclus) | 4000 | 6000 |
| COMPLET | 96 à 100 | aucun LCO vendu | aucun LCO vendu |

Limites incluses aux bornes : 60 → MOYENNE, 85 → MOYENNE, 95 → HAUTE, 96 → COMPLET. **[Décision de la squad, d'après la v0 : « 60 % à 85 % », « > 85 % à 95 % », « > 95 % »]**

## Prix d'un créneau

`priceMinor = clamp(floorMinor + 1000 × (heures après le départ standard − 1), floorMinor, ceilingMinor)`

- Le créneau est une heure pleine entre départ standard + 1 h et l'heure limite LCO de l'hôtel. **[Nexus : regles-metier.md, RM-03 ; hotels-pilotes.md]**
- Le prix est TTC ; le montant débité est exactement celui-ci, recalculé côté serveur. **[Nexus : decisions-deja-prises.md ; SEC-05]**

Exemple, VEL-LYO-02 (départ standard 11:00), départ le 2026-11-03, nuit du 2026-11-02 à 62 % → MOYENNE, créneau 13:00 :
`2500 + 1000 × (2 − 1) = 3500` → 35,00 €.

## Interface exposée (pour Offre et Paiement)

`GET /v1/pricing/late-checkout/bounds?hotelId=VEL-LYO-02&date=2026-11-03`

| Paramètre | Type | Unité / format | Exemple |
|---|---|---|---|
| `hotelId` | string | identifiant `VEL-…` d'un hôtel pilote | `VEL-LYO-02` |
| `date` | string | **date de départ**, `YYYY-MM-DD`, heure locale de l'hôtel | `2026-11-03` |

### Réponse 200

```json
{ "hotelId": "VEL-LYO-02", "date": "2026-11-03", "forecastNight": "2026-11-02",
  "occupancyRate": 62, "band": "MOYENNE",
  "floorMinor": 2500, "ceilingMinor": 4500, "currency": "EUR",
  "forecastGeneratedAt": "2026-11-02T06:00:00+01:00" }
```

| Champ | Type | Unité | Exemple |
|---|---|---|---|
| `hotelId` | string | `VEL-…` | `VEL-LYO-02` |
| `date` | string | date de départ `YYYY-MM-DD` | `2026-11-03` |
| `forecastNight` | string | nuit utilisée, `YYYY-MM-DD` (= `date − 1`) | `2026-11-02` |
| `occupancyRate` | integer | % d'occupation prévue | `62` |
| `band` | string | `BASSE` \| `MOYENNE` \| `HAUTE` | `MOYENNE` |
| `floorMinor` | integer | centimes | `2500` |
| `ceilingMinor` | integer | centimes | `4500` |
| `currency` | string | ISO 4217 | `EUR` |
| `forecastGeneratedAt` | string | ISO 8601 avec fuseau | `2026-11-02T06:00:00+01:00` |

### Erreurs (format `{ "code", "message", "details" }`)

| HTTP | `code` | Quand | Effet attendu côté Offre |
|---|---|---|---|
| 422 | `LCO_HOTEL_FULL` | occupation prévue > 95 % | réservation non éligible, motif `HOTEL_FULL` |
| 422 | `LCO_FORECAST_MISSING` | aucune prévision pour la nuit `date − 1` | réservation non éligible, aucun LCO vendu **[Nexus : decisions-deja-prises.md]** |
| 422 | `LCO_HOTEL_NOT_IN_PILOT` | `hotelId` hors des 5 hôtels pilotes | aligné sur `offre-api.md` 0.1.0 |
| 400 | `LCO_INVALID_REQUEST` | paramètre absent ou mal formé | — |

**[Décision de la squad]** pour les codes `LCO_HOTEL_FULL`, `LCO_FORECAST_MISSING`, `LCO_INVALID_REQUEST`.

## Mock fourni aux autres squads (API-05)

- Module `src/mocks/regle-prix.ts` du starter Prix, à copier dans les starters Offre et Paiement : même signature que l'API, données de `data/occupation-prevue.json` (5 hôtels, 7 nuits). **[Décision de la squad]**
- Cas couverts par le mock : une tranche de chaque sorte, `LCO_HOTEL_FULL` (ex. VEL-PAR-01, départ le 2026-11-06, nuit à 97 %), `LCO_FORECAST_MISSING` (nuit hors échantillon).
- Disponible avant G2.

## Points à trancher par la squad avant publication

- `date` = date de **départ** (la v0 était ambiguë : son exemple lisait la nuit du 2026-11-02 à partir de `date=2026-11-02`).
- Codes d'erreur ci-dessus, à annoncer aux squads Offre et Paiement.
- Seuil d'ancienneté de la prévision au-delà duquel on la considère absente : **[À confirmer : revenue management]**
