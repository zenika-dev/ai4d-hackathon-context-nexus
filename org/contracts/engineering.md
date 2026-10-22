---
id: org/engineering
register: contracts
level: org
owner: quality-guild
status: active
version: 1.0.0
last-validated: 2026-10-21
consumption-mode: system-prompt
---

# Contract · Engineering (org)

| ID | Assertion | Seuil | Vérification |
|---|---|---|---|
| ENG-01 | Lint sans erreur | 0 erreur | CI du starter |
| ENG-02 | Tests verts | 100 % | CI du starter |
| ENG-03 | Couverture des lignes du code nouveau | ≥ 70 % (dry run) | CI du starter |
| ENG-04 | Chaque critère d'acceptance de la spec est couvert par au moins un test nommé | 100 % | gate-check G3 |
| ENG-05 | Feature flag présent, désactivé par défaut, bascule tracée | oui | gate-check G4 |
| ENG-06 | Coût en tokens de la squad relevé à chaque gate | oui | greffier |
