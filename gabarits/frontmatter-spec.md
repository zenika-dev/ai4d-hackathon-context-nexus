# Frontmatter à coller en tête d'une spec Spec Kit publiée dans le Nexus

```yaml
---
id: <squad>/spec-001
register: intent
level: team
owner: <prénom.nom>
status: active
version: 1.0.0
last-validated: 2026-10-26
consumption-mode: context-injection
source: starter-<squad>/specs/001-<nom>/spec.md
consumes: [teams/<squad>/intent/business-intent.md@1.0.0, teams/<autre-squad>/contracts/<contrat>.md@<version actuelle>, ...]
---
```

Épinglez **toutes** les versions de contrats des autres squads que la spec utilise. C'est cet épinglage qui permet à
`context-assemble` de vous prévenir quand une autre squad publie une nouvelle version.
