---
id: programme/tarifs-nuit-pilotes
register: knowledge
level: programme
owner: direction-revenu-annexe
status: active
version: 1.0.0
last-validated: 2026-10-26
consumption-mode: context-injection
consumes: [programme/late-checkout/knowledge/hotels-pilotes.md@1.0.0]
---

# Tarif de la nuit des hôtels pilotes (référentiel commun, données synthétiques)

Tarif moyen d'une nuit, en centimes d'euro (`nightlyRateMinor`). Sert de base au plafond de late check-out exprimé en pourcentage (`regle-prix` 2.0.0).

| hotelId | Ville | `nightlyRateMinor` | Devise |
|---|---|---|---|
| VEL-PAR-01 | Paris | 24000 | EUR |
| VEL-LYO-02 | Lyon | 13000 | EUR |
| VEL-BDX-03 | Bordeaux | 11000 | EUR |
| VEL-MRS-04 | Marseille | 15000 | EUR |
| VEL-NCE-05 | Nice | 17000 | EUR |
