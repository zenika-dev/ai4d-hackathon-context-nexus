---
id: programme/composants-ui
register: contracts
level: programme
owner: design-transverse
status: active
version: 1.0.0
last-validated: 2026-10-21
consumption-mode: context-injection
---

# Contract · Composants UI communs (design system fictif « Vela DS »)

Étend `org/contracts/accessibility.md`.

| Composant | Usage autorisé | Règles |
|---|---|---|
| `VelaTile` | Entrée de service dans « Gérer ma réservation » | Titre ≤ 32 caractères, icône + sous-titre, une seule action |
| `VelaCard` | Détail d'une offre | Prix toujours accompagné de la devise, mention « taxes incluses » |
| `VelaSlotPicker` | Choix d'un créneau horaire | Créneaux indisponibles affichés grisés avec motif, jamais masqués |
| `VelaPaymentSheet` | Paiement | Seul composant autorisé à afficher le choix « payer en ligne / à l'hôtel » |
| `VelaToast` | Confirmation | Disparaît après 4 s, contenu repris dans la réservation |

Format d'affichage des prix : `25,00 €` (fr-FR), `€25.00` (en-GB).
