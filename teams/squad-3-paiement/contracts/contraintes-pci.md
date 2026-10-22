---
id: squad-3-paiement/contraintes-pci
register: contracts
level: team
owner: squad-3-paiement
status: active
version: 0.1.0
last-validated: 2026-10-23
consumption-mode: system-prompt
consumes: [org/contracts/security.md@1.0.0]
consumers: [squad-4-experience]
exception-to: null
exception-approved-by: null
---

# Contraintes PCI du supplément · v0

Extension de `org/contracts/security.md` (aucune exception déclarée).

| ID | Assertion |
|---|---|
| PCI-01 | La saisie de la carte se fait exclusivement dans le composant PayVel (`VelaPaymentSheet` côté Expérience). Nos services ne reçoivent qu'un `paymentToken`. |
| PCI-02 | Les logs du service de paiement ne contiennent ni jeton complet, ni montant associé à une identité client : jeton tronqué à 6 caractères. |
| PCI-03 | Le code qui déclenche un débit en ligne porte une signature humaine nommée (SEC-02). |
| PCI-04 | Le mode `AT_HOTEL` ne déclenche aucun appel PayVel. |
