---
id: programme/api-design
register: contracts
level: programme
owner: tech-lead-programme
status: active
version: 1.0.0
last-validated: 2026-10-21
consumption-mode: system-prompt
---

# Contract · Design d'API (programme late check-out)

Étend `org/knowledge/conventions.md`.

| ID | Assertion |
|---|---|
| API-01 | Chaque API publiée a un contrat dans `teams/<squad>/contracts/` avec un schéma (OpenAPI ou JSON Schema) **valide**. |
| API-02 | Chaque champ a un type, une unité et un exemple. Tout montant est un **entier en centimes** nommé `…Minor` (`amountMinor`, `priceMinor`), accompagné de sa devise. |
| API-03 | Un changement qui casse un consommateur incrémente la version **majeure** du contrat. |
| API-04 | Chaque contrat liste ses consommateurs connus (`consumers`), qui l'épinglent dans `consumes`. |
| API-05 | Chaque squad fournit un **mock** de son API (ou de sa règle) utilisable par les voisines dès G2. |
