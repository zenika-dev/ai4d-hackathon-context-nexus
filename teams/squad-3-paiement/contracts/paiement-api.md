---
id: squad-3-paiement/paiement-api
register: contracts
level: team
owner: squad-3-paiement
status: active
version: 0.1.0
last-validated: 2026-10-23
consumption-mode: context-injection
consumes: [teams/squad-1-offre/contracts/offre-api.md@0.1.0, teams/squad-2-prix/contracts/regle-prix.md@0.1.0, org/contracts/security.md@1.0.0]
consumers: [squad-4-experience]
exception-to: null
exception-approved-by: null
---

# Contrat de paiement du supplément · v0 (écrit par l'animation, à reprendre par la squad Paiement)

> v0 : point de départ. La squad Paiement le relit, le complète et publie la **v1** avant G2.

## Endpoint

`POST /v1/late-checkout/payments` · en-tête `Idempotency-Key` obligatoire.

```json
{
  "reservationId": "RES-104233",
  "offerId": "LCO-7f3a9c",
  "slot": "13:00",
  "amountMinor": 3500,
  "currency": "EUR",
  "mode": "ONLINE",
  "paymentToken": "pvt_tok_9d1e..."
}
```

| Champ | Type | Description |
|---|---|---|
| `amountMinor` | integer | Montant en **centimes**. Recalculé côté serveur (SEC-05) : doit être égal à `options[].priceMinor` de l'offre pour ce créneau, sinon `409` |
| `mode` | `ONLINE` \| `AT_HOTEL` | `ONLINE` : débit immédiat PayVel. `AT_HOTEL` : ajout à la note de chambre |
| `paymentToken` | string | Jeton PayVel. Obligatoire si `ONLINE`, interdit si `AT_HOTEL` |

## Réponse 201

```json
{ "paymentId": "PAY-55120", "status": "CAPTURED", "amountMinor": 3500, "currency": "EUR",
  "mode": "ONLINE", "createdAt": "2026-11-01T18:42:10+01:00" }
```

Statuts : `CAPTURED` (en ligne), `POSTED_TO_FOLIO` (à l'hôtel), `FAILED`, `REFUNDED`.

## Erreurs

`409 LCO_AMOUNT_MISMATCH`, `409 LCO_OFFER_EXPIRED`, `409 LCO_ALREADY_PURCHASED`, `402 LCO_PAYMENT_DECLINED`.

## Ce que la v1 doit encore préciser

- Le remboursement (RM-04) et son endpoint.
- Les contraintes PCI détaillées (voir `contraintes-pci.md`).
- Le mock PayVel et le mock de l'API fournis aux voisines (API-05).
