---
id: org/conventions
register: knowledge
level: org
owner: architecture-platform
status: active
version: 1.0.0
last-validated: 2026-10-21
consumption-mode: system-prompt
---

# Conventions d'ingénierie

- Langage des starters : TypeScript (Node 20+), tests avec le runner fourni dans le starter.
- API REST JSON, noms de champs en `camelCase`, ressources au pluriel, versions dans le chemin (`/v1/...`).
- Erreurs au format `{ "code": "LCO_xxx", "message": "...", "details": {} }`.
- Identifiants métier préfixés : réservation `RES-…`, hôtel `VEL-…`, offre `LCO-…`, paiement `PAY-…`.
- Un endpoint qui crée une ressource accepte un en-tête `Idempotency-Key`.
- Les événements analytiques sont en `snake_case`, au passé (`purchase_completed`), avec `event_id`, `occurred_at`, `reservation_id`.
- Langue du code : anglais. Langue des specs et du Context Nexus : français.
