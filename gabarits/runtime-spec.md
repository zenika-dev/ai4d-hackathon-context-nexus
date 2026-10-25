---
id: <squad>/runbook
register: operations
level: team
owner: <prénom.nom, owner d'exploitation>
status: active
version: 1.0.0
last-validated: 2026-10-26
consumption-mode: skill
consumes: [programme/late-checkout/operations/feature-flags.md@1.0.0, programme/late-checkout/operations/deploiement.md@1.1.0]
---

# Runtime Spec · <volet> · G4 Released and Observable

## Owner d'exploitation
<Nom, et qui le remplace.>

## Flag
| Nom | État | Ligne du journal (`flags-journal.md`) |
|---|---|---|

## Observabilité
| Signal | Où le lire | Seuil d'alerte |
|---|---|---|

## KPI et événements instrumentés
<Lien vers les KPI (Prix) ou événements (Expérience) effectivement émis.>

## Runbook
1. Symptôme → diagnostic → action.

## Rollback
<Commande, durée, qui décide, qui prévenir.>

## Coût IA
<Consommation de Claude relevée dans la barre de gauche (« Session ») et ce qu'elle a produit (tests verts, gates passées). Le TOM lit toujours le coût avec la qualité.>
