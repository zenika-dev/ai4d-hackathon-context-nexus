---
id: programme/deploiement
register: operations
level: programme
owner: collectif-programme
status: active
version: 1.0.0
last-validated: 2026-10-21
consumption-mode: skill
---

# Procédure · Déploiement sur le starter

> À compléter par Nicolas (starter) avant le 23/10 : commande exacte et environnement cible.

1. CI verte sur `main` (lint, tests, couverture, scans).
2. `npm run deploy` : déploie sur l'environnement du starter, flags inchangés.
3. Vérifier la sonde de santé et les métriques (`npm run observe`).
4. Basculer le flag selon `feature-flags.md`.
5. Publier dans `teams/<squad>/operations/` : runbook, journal de flags, KPI instrumentés.
