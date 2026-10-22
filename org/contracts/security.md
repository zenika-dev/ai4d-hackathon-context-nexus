---
id: org/security
register: contracts
level: org
owner: security-guild
status: active
version: 1.0.0
last-validated: 2026-10-21
consumption-mode: system-prompt
---

# Contract · Sécurité et PCI-DSS (org)

Assertions vérifiables, sans exception sauf `exception-to` approuvé par `security-guild`.

| ID | Assertion | Vérification |
|---|---|---|
| SEC-01 | Aucun champ nommé ou ressemblant à `pan`, `cardNumber`, `cvv`, `cvc`, `expiry` dans le code, les schémas et les logs | scan du gate-check |
| SEC-02 | Toute fonction qui déclenche un débit est revue et signée par un humain nommé avant merge (`Signed-off-by` dans le commit + nom dans le dossier G3) | revue G3 |
| SEC-03 | Aucune dépendance avec vulnérabilité `high` ou `critical` | `npm audit --audit-level=high` |
| SEC-04 | Aucun secret en clair dans le dépôt | scan du gate-check |
| SEC-05 | Les montants débités sont recalculés côté serveur, jamais repris tels quels du client | revue G3 + test |
