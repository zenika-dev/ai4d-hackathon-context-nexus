---
id: programme/deploiement
register: operations
level: programme
owner: collectif-programme
status: active
version: 1.1.0
last-validated: 2026-10-23
consumption-mode: skill
---

# Procédure · Déploiement sur le starter

Environnement cible du dry run : le poste ou le Codespace pilote de la squad (service local, un port par squad :
3001 Offre, 3002 Prix, 3003 Paiement, 3004 Expérience).

1. CI verte sur `main` : lint, typecheck, tests et couverture, scan PCI et secrets, audit des dépendances.
2. `npm run deploy` : build, arrêt de l'instance précédente, démarrage en arrière-plan, sonde `/health`. Flags inchangés.
3. `npm run observe` : santé, flags actifs et compteurs de requêtes (`/metrics`).
4. Basculer le flag selon `feature-flags.md` (`npm run flag -- <nom> on --reason "…"`), puis `npm run deploy` pour qu'il soit pris en compte.
5. Publier dans `teams/<squad>/operations/` : runbook, journal de flags, KPI instrumentés.
6. Vérifier avec `npm run gate-check -- G4`.

Rollback : `npm run flag -- <nom> off --reason "rollback : …"`, puis `npm run deploy`.
