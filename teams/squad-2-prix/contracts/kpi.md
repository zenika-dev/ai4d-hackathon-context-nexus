---
id: squad-2-prix/kpi
register: contracts
level: team
owner: squad-2-prix
status: active
version: 0.1.0
last-validated: 2026-10-23
consumption-mode: context-injection
consumes: [teams/squad-4-experience/contracts/evenements-achat.md@0.1.0, teams/squad-1-offre/contracts/offre-api.md@0.1.0]
consumers: [squad-4-experience, gate-keeper-data]
exception-to: null
exception-approved-by: null
---

# Définition des KPI de l'offre late check-out · v0

| KPI | Définition | Source | Seuil cible |
|---|---|---|---|
| `attach_rate` | réservations ayant acheté un LCO / réservations éligibles | événements `purchase_completed` + API d'offre | à fixer en G1 |
| `lco_revenue_per_eligible` | somme des suppléments / réservations éligibles, en centimes | `purchase_completed.amount_minor` | à fixer en G1 |
| `tile_to_purchase` | `purchase_completed` / `tile_viewed` | événements Expérience | à fixer en G1 |
| `online_share` | achats `mode=ONLINE` / tous les achats | événements Expérience | suivi, sans seuil |
| `reception_override_rate` | LCO gratuits accordés à la réception / LCO vendus | ancien processus (RM-08) | suivi, sans seuil |

Les seuils cibles sont des décisions humaines (Intent) : ils viennent de la Business Intent Spec, pas de l'agent.
