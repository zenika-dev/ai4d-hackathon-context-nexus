---
id: squad-1-offre/offre-api
register: contracts
level: team
owner: squad-1-offre
status: active
version: 0.1.0
last-validated: 2026-10-23
consumption-mode: context-injection
consumes: [programme/late-checkout/knowledge/hotels-pilotes.md@1.0.0, teams/squad-2-prix/contracts/regle-prix.md@0.1.0]
consumers: [squad-3-paiement, squad-4-experience, squad-2-prix]
exception-to: null
exception-approved-by: null
---

# Contrat d'API d'offre · v0 (écrit par l'animation, à reprendre par la squad Offre)

> v0 : point de départ. La squad Offre le relit, le complète et publie la **v1** avant G2.

## Endpoint

`GET /v1/reservations/{reservationId}/late-checkout-offer`

Renvoie l'éligibilité d'une réservation au late check-out et, si elle est éligible, les créneaux et leur prix.

## Réponse 200

```json
{
  "offerId": "LCO-7f3a9c",
  "reservationId": "RES-104233",
  "hotelId": "VEL-LYO-02",
  "eligible": true,
  "reasons": [],
  "standardCheckoutTime": "11:00",
  "options": [
    { "slot": "13:00", "priceMinor": 3500, "currency": "EUR" },
    { "slot": "15:00", "priceMinor": 4500, "currency": "EUR" }
  ],
  "expiresAt": "2026-11-01T22:00:00+01:00"
}
```

| Champ | Type | Description |
|---|---|---|
| `offerId` | string | Identifiant de l'offre, à repasser au paiement |
| `eligible` | boolean | Réservation éligible ou non |
| `reasons` | string[] | Motifs de non-éligibilité : `NOT_CONFIRMED`, `CANCELLED`, `TOO_LATE`, `ALREADY_PURCHASED`, `HOTEL_FULL` |
| `standardCheckoutTime` | string `HH:mm` | Heure de départ standard de l'hôtel (heure locale) |
| `options[].slot` | string `HH:mm` | Créneau de départ proposé |
| `options[].priceMinor` | integer | Prix TTC du créneau, en **centimes** (`3500` = 35,00 €), calculé avec la règle de prix |
| `options[].currency` | string ISO 4217 | Devise |
| `expiresAt` | string ISO 8601 | Fin de validité de l'offre (RM-01) |

## Erreurs

`404 LCO_RESERVATION_NOT_FOUND`, `422 LCO_HOTEL_NOT_IN_PILOT`.

## Ce que la v1 doit encore préciser

- Les règles d'éligibilité exactes (RM-02, RM-03) et leur source de données.
- Le calcul du prix de chaque créneau à partir de la règle de prix.
- Le mock fourni aux autres squads (API-05).
