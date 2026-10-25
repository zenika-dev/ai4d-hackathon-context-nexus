

## Changement 2.0.0 · le plafond devient un pourcentage

> Décision de la Direction Revenu Annexe, 2026-10-26. **Rupture pour les consommateurs** (Offre, Paiement) : `ceilingMinor` n'existe plus dans la réponse. Cette section remplace les bornes ci-dessus.

| Tranche | Occupation prévue | `floorMinor` | `ceilingPercent` |
|---|---|---|---|
| BASSE | < 60 % | 1500 | 25 |
| MOYENNE | 60 % à 85 % | 2500 | 35 |
| HAUTE | > 85 % à 95 % | 4000 | 45 |
| COMPLET | > 95 % | aucun LCO vendu | aucun LCO vendu |

- `ceilingPercent` est un **entier** : un pourcentage du tarif de la nuit de l'hôtel, lu dans `programme/late-checkout/knowledge/tarifs-nuit-pilotes.md` (champ `nightlyRateMinor`, en centimes).
- Le plafond en centimes se calcule chez le consommateur : `ceilingMinor = floor(nightlyRateMinor × ceilingPercent / 100)`. Arrondi au centime inférieur : le plafond ne dépasse jamais le pourcentage.
- Le plancher reste un montant en centimes.
- Prix d'un créneau, inchangé : `prixMinor = clamp(floorMinor + 1000 × (heures après le départ standard − 1), floorMinor, ceilingMinor)`.

Exemple, VEL-LYO-02 (tarif de nuit 13 000), tranche MOYENNE : `ceilingMinor = floor(13000 × 35 / 100) = 4550`, soit 45,50 € (contre 45,00 € en v0 / v1).

Interface, réponse modifiée :

```json
{ "hotelId": "VEL-LYO-02", "date": "2026-11-02", "band": "MOYENNE",
  "floorMinor": 2500, "ceilingPercent": 35, "currency": "EUR" }
```

**Ce que les consommateurs doivent faire** : lire ce changement, épingler `regle-prix@2.0.0` et le nouveau référentiel `tarifs-nuit-pilotes@1.0.0` dans leur `consumes`, mettre à jour specs, critères d'acceptance, tâches et tests, puis republier.
