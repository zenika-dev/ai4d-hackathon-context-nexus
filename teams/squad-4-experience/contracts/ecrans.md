---
id: squad-4-experience/ecrans
register: contracts
level: team
owner: squad-4-experience
status: active
version: 0.1.0
last-validated: 2026-10-23
consumption-mode: context-injection
consumes: [teams/squad-1-offre/contracts/offre-api.md@0.1.0, teams/squad-3-paiement/contracts/paiement-api.md@0.1.0, programme/late-checkout/contracts/composants-ui.md@1.0.0]
consumers: [squad-2-prix]
exception-to: null
exception-approved-by: null
---

# Spec des écrans · tuile et carte late check-out · v0 (écrite par l'animation, à reprendre par la squad Expérience)

> v0 : point de départ. La squad Expérience la relit, la complète et publie la **v1** avant G2.

## Parcours

1. **Tuile** `VelaTile` dans « Gérer ma réservation » : « Partir plus tard », sous-titre « dès 15,00 € ».
   Visible seulement si l'API d'offre répond `eligible: true`.
2. **Carte** `VelaCard` + `VelaSlotPicker` : créneaux et prix issus de `options[]`.
3. **Paiement** `VelaPaymentSheet` : « Payer maintenant » ou « Payer à l'hôtel ».
4. **Confirmation** `VelaToast` + nouvelle heure de départ visible dans la réservation.

## États à couvrir

| État | Déclencheur | Affichage |
|---|---|---|
| Éligible | `eligible: true` | Tuile visible |
| Non éligible | `eligible: false` | Tuile masquée |
| Déjà acheté | `reasons` contient `ALREADY_PURCHASED` | Tuile « Départ à 13:00 confirmé » |
| Offre expirée | `409 LCO_OFFER_EXPIRED` | Message + retour à la réservation |
| Paiement refusé | `402 LCO_PAYMENT_DECLINED` | Message + proposer « Payer à l'hôtel » |

## Plateformes

Web (site) et app (iOS, Android). Le dry run implémente **une** plateforme au choix de la squad, les autres sont spécifiées.

## Ce que la v1 doit encore préciser

- Maquettes basse fidélité de chaque état (photo du mur de squad acceptée).
- Critères d'accessibilité vérifiables (A11Y-01 à 03).
