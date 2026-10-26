---
id: squad-3-paiement/business-intent
register: intent
level: team
owner: sylvain.biancardini
status: active
version: 1.0.0
last-validated: 2026-10-26
consumption-mode: context-injection
consumes: [programme/late-checkout/knowledge/brief.md@1.1.0, programme/late-checkout/knowledge/regles-metier.md@1.0.0, programme/late-checkout/knowledge/decisions-deja-prises.md@1.0.0]
---

# Business Intent Spec · Paiement · G1 Ready to Spec

> Les 5 champs sont une hypothèse de travail (non figée au TOM). Chaque affirmation est **datée et sourcée**, avec l'une de ces quatre étiquettes :
> - **[Nexus : chemin du fichier]** : un fait, une règle ou une décision déjà prise, trouvé dans le Context Nexus (brief, règles métier, `decisions-deja-prises.md`, contrats) ;
> - **[Direction Revenu Annexe, date]** : son ambition chiffrée, l'horizon, la priorité. Ce sont ses décisions pour ce projet : on va les lui demander ;
> - **[Décision de la squad]** : ce que la squad choisit et signe (son seuil de succès engagé, l'owner, ce qu'on ne fait pas) ;
> - **[À confirmer : qui peut répondre]** : ce que personne n'a encore, jamais inventé.

## 1. Problème
- Les clients demandent souvent à partir plus tard ; les hôtels l'accordent à la réception, au cas par cas : du revenu perdu et de la friction. [Nexus : programme/late-checkout/knowledge/brief.md, reçu le 2026-10-21]
- Aujourd'hui la réception accorde le late check-out à la main, sans trace ; aucune solution de vente en ligne n'existe chez Vélora. [Nexus : programme/late-checkout/knowledge/decisions-deja-prises.md]
- Le volet Paiement doit encaisser le supplément : en ligne (débit immédiat PayVel) ou à l'hôtel (ajout à la note de chambre). [Nexus : programme/late-checkout/knowledge/regles-metier.md, RM-06]
- Le prix affiché est TTC et le montant débité est exactement le montant affiché. [Nexus : programme/late-checkout/knowledge/decisions-deja-prises.md, 2026-10-21]
- Taux d'échec réel des paiements : [À confirmer : personne aujourd'hui, à mesurer par le pilote]

## 2. Utilisateurs et parties prenantes
- Client final qui a réservé et veut partir plus tard. [Nexus : brief.md]
- Réception de l'hôtel : peut toujours accorder un LCO gratuit (RM-08) et rembourse à la main si le remboursement passe en v2. [Nexus : regles-metier.md ; decisions-deja-prises.md]
- Direction Revenu Annexe : cliente du projet, valide la règle côté métier. [Nexus : decisions-deja-prises.md]
- Autres squads : Offre (`offre-api`), Prix (`regle-prix`), Expérience (consomme notre API de paiement). [Nexus : contrats épinglés dans le brief]
- Security guild : approuve toute exception PCI. [Nexus : org/contracts/security.md]

## 3. Critère de succès chiffré
- Ambition chiffrée du pilote : 10 000 clients à 35 €, soit 350 000 € de revenu annexe (35 000 000 centimes). [Direction Revenu Annexe, 2026-10-26]
- Horizon de mesure : un an. [Direction Revenu Annexe, 2026-10-26]
- Pour la squad Paiement, cela représente environ 10 000 paiements réussis sur l'année (en ligne ou à l'hôtel), au prix moyen de 35 € de l'exemple de la règle de prix. [Nexus : teams/squad-2-prix/contracts/regle-prix.md]
- Seuil engagé par la squad Paiement : au moins 95 % des paiements tentés aboutissent, sur l'horizon d'un an. [Décision de la squad, 2026-10-26, signée par sylvain.biancardini]
- `online_share` et `reception_override_rate` : suivis, sans seuil. [Nexus : decisions-deja-prises.md]

## 4. Données
- Hôtels pilotes, fuseau `Europe/Paris`, horaires et créneaux : **disponible**. [Nexus : programme/late-checkout/knowledge/hotels-pilotes.md]
- Données synthétiques (hôtels, réservations, occupation prévue), montants en centimes : **disponible** dans `data/` du starter. [Nexus : CLAUDE.md du starter]
- Prévision d'occupation : produite une fois par nuit à 06:00 heure locale, sur 14 jours ; absente → aucun LCO vendu. **Disponible** via le contrat Prix. [Nexus : decisions-deja-prises.md]
- Offre et prix de chaque créneau (`offerId`, `priceMinor`) : **disponible** en v0 (mock), v1 attendue. [Nexus : teams/squad-1-offre/contracts/offre-api.md]
- Jeton `paymentToken` PayVel : aucune donnée de carte chez nous (PAN, CVV, expiration interdits). [Nexus : org/contracts/security.md SEC-01 ; contraintes-pci.md PCI-01]
- Nombre de réservations éligibles par jour : **à acquérir** [À confirmer : expert Data]
- Volume actuel de LCO gratuits : [À confirmer : personne aujourd'hui, mesuré par le pilote]

## 5. Priorité et owner
- Priorité du pilote : moyenne. [Direction Revenu Annexe, 2026-10-26]
- Owner de l'intention : sylvain.biancardini. [Décision de la squad, 2026-10-26]
- Ce qu'on ne fait pas : le remboursement (RM-04) est repoussé en v2 ; la réception rembourse alors à la main. [Décision de la squad, 2026-10-26 ; acceptable d'après Nexus : decisions-deja-prises.md]
- Pourquoi maintenant : l'achat est possible jusqu'à la veille du départ 22:00 (RM-01) et les autres squads attendent notre contrat v1 avant G2. [Nexus : regles-metier.md]

## Réutilisation
Aucune solution de vente du late check-out en ligne n'existe chez Vélora ; l'ancien processus (accord manuel à la réception) est maintenu en parallèle pendant le pilote. [Nexus : decisions-deja-prises.md] Le paiement passe par le PSP fictif PayVel et son composant `VelaPaymentSheet`. [Nexus : contraintes-pci.md PCI-01]

## Dépendances vers les autres squads
| Ce dont on a besoin | Squad | Contrat (version lue) | Question ouverte |
|---|---|---|---|
| `offerId`, `priceMinor` par créneau, `expiresAt` pour recalculer le montant (SEC-05) | Offre | offre-api v0 | Date de publication de la v1 ? |
| Bornes plancher et plafond du pilote | Prix | regle-prix v0 | Source et date de la prévision d'occupation (v1) ? |
| Format de l'événement d'achat à émettre | Expérience | evenements-achat (pas encore publié) | Champs attendus pour `purchase_completed` ? |
