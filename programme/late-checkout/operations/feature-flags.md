---
id: programme/feature-flags
register: operations
level: programme
owner: collectif-programme
status: active
version: 1.0.0
last-validated: 2026-10-21
consumption-mode: skill
---

# Procédure · Feature flags

1. Le flag est déclaré dans le starter (`flags.json`) avec la valeur `false`.
2. Nom : `lco_<squad>_<fonction>` (ex. `lco_offre_api`).
3. **Toute bascule** passe par le script du starter (`npm run flag -- <nom> on|off --reason "<pourquoi>"`), qui écrit une ligne dans `teams/<squad>/operations/flags-journal.md` :
   `| 2026-10-26T11:47:00+01:00 | lco_offre_api | on | prénom.nom | motif |`
4. Une bascule sans ligne de journal = gate G4 en no-go.
5. Rollback : bascule `off` + ligne de journal + message dans le canal de la squad.
