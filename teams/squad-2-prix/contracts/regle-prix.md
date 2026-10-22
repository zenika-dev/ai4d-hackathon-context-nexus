---
id: squad-2-prix/regle-prix
register: contracts
level: team
owner: squad-2-prix
status: active
version: 0.1.0
last-validated: 2026-10-23
consumption-mode: context-injection
consumes: [programme/late-checkout/knowledge/hotels-pilotes.md@1.0.0]
consumers: [squad-1-offre, squad-3-paiement]
exception-to: null
exception-approved-by: null
---

# Règle de prix · plancher et plafond · v0 (écrite par l'animation, à reprendre par la squad Prix)

> v0 : point de départ. La squad Prix la relit, la complète et publie la **v1** avant G2.

## Principe

Le supplément d'un créneau LCO est borné par un plancher et un plafond qui dépendent de l'**occupation prévue**
de l'hôtel pour la nuit du départ.

## Bornes par tranche d'occupation prévue

Tous les montants sont des **entiers en centimes** de la devise de la réservation (`1500` = 15,00 €).

| Tranche | Occupation prévue | `floorMinor` | `ceilingMinor` |
|---|---|---|---|
| BASSE | < 60 % | 1500 | 3000 |
| MOYENNE | 60 % à 85 % | 2500 | 4500 |
| HAUTE | > 85 % à 95 % | 4000 | 6000 |
| COMPLET | > 95 % | aucun LCO vendu | aucun LCO vendu |

## Prix d'un créneau

`prixMinor = clamp(floorMinor + 1000 × (heures après le départ standard − 1), floorMinor, ceilingMinor)`

Exemple, VEL-LYO-02 (départ standard 11:00), tranche MOYENNE, créneau 13:00 :
`2500 + 1000 × (2 − 1) = 3500` → 35,00 €.

## Interface exposée (pour Offre et Paiement)

`GET /v1/pricing/late-checkout/bounds?hotelId=VEL-LYO-02&date=2026-11-02`

```json
{ "hotelId": "VEL-LYO-02", "date": "2026-11-02", "band": "MOYENNE",
  "floorMinor": 2500, "ceilingMinor": 4500, "currency": "EUR" }
```

## Ce que la v1 doit encore préciser

- La source et la date de la prévision d'occupation utilisée.
- Le comportement si la prévision est absente.
- Le mock fourni aux squads voisines (API-05).
