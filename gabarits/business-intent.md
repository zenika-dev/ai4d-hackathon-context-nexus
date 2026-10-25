---
id: <squad>/business-intent
register: intent
level: team
owner: <prénom.nom du PO ou du pilote du Discover>
status: draft
version: 1.0.0
last-validated: 2026-10-26
consumption-mode: context-injection
consumes: [programme/late-checkout/knowledge/brief.md@1.1.0, programme/late-checkout/knowledge/regles-metier.md@1.0.0, programme/late-checkout/knowledge/decisions-deja-prises.md@1.0.0]
---

# Business Intent Spec · <volet> · G1 Ready to Spec

> Les 5 champs sont une hypothèse de travail (non figée au TOM). Chaque affirmation est **datée et sourcée**, avec l'une de ces quatre étiquettes :
> - **[Nexus : chemin du fichier]** : un fait, une règle ou une décision déjà prise, trouvé dans le Context Nexus (brief, règles métier, `decisions-deja-prises.md`, contrats) ;
> - **[Direction Revenu Annexe, date]** : son ambition chiffrée, l'horizon, la priorité. Ce sont ses décisions pour ce projet : on va les lui demander ;
> - **[Décision de la squad]** : ce que la squad choisit et signe (son seuil de succès engagé, l'owner, ce qu'on ne fait pas) ;
> - **[À confirmer : qui peut répondre]** : ce que personne n'a encore, jamais inventé.

## 1. Problème
<Quel problème, pour qui, constaté comment ? Source et date.>

## 2. Utilisateurs et parties prenantes
<Client final, réception, Direction Revenu, autres squads…>

## 3. Critère de succès chiffré
<Métrique + seuil + horizon. Ex. : « taux d'attachement ≥ X % des réservations éligibles à 30 jours ». Qui l'a fixé ?>

## 4. Données
<Quelles données, quelle source, quelle date. Pour chacune, sa disponibilité : **disponible**, **à acquérir** ou **bloquée**. Ce qu'il manque et qui peut le fournir.>

## 5. Priorité et owner
<Pourquoi maintenant, ce qu'on ne fait pas, qui répond de cette intention.>

## Réutilisation
<Existe-t-il déjà une solution (chez Vélora ou dans les autres squads) ? Nommez-la, ou justifiez son absence. Critère de G1 dans le TOM.>

## Dépendances vers les autres squads
| Ce dont on a besoin | Squad | Contrat (version lue) | Question ouverte |
|---|---|---|---|
