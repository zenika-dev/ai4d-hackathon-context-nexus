---
id: squad-4-experience/evenements-achat
register: contracts
level: team
owner: squad-4-experience
status: active
version: 0.1.0
last-validated: 2026-10-23
consumption-mode: context-injection
consumes: [teams/squad-1-offre/contracts/offre-api.md@0.1.0]
consumers: [squad-2-prix]
exception-to: null
exception-approved-by: null
---

# Événements d'achat · v0

Champs communs à tous les événements : `event_id` (uuid), `occurred_at` (ISO 8601), `reservation_id`, `hotel_id`, `platform` (`web` | `ios` | `android`).

| Événement | Quand | Champs spécifiques |
|---|---|---|
| `tile_viewed` | La tuile est affichée | `offer_id` |
| `offer_viewed` | La carte est ouverte | `offer_id`, `slots_count` |
| `slot_selected` | Un créneau est choisi | `offer_id`, `slot`, `amount_minor` |
| `purchase_started` | Le paiement est lancé | `offer_id`, `slot`, `amount_minor`, `currency`, `mode` |
| `purchase_completed` | Le paiement est confirmé | `offer_id`, `payment_id`, `slot`, `amount_minor`, `currency`, `mode` |
| `purchase_failed` | Le paiement échoue | `offer_id`, `error_code`, `mode` |

`amount_minor` : entier, en centimes, repris de `options[].priceMinor` de l'offre. Ces événements alimentent les KPI de la squad Prix (`kpi.md`).
