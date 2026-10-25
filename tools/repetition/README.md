# Répétition en solo

Pour l'animation : dérouler le hackathon seul, en jouant une squad, pendant que cet outil joue les trois autres.
À utiliser **uniquement sur un Nexus de répétition** (une copie privée), jamais sur le Nexus partagé du jour J.

| Commande | Ce que font les autres squads |
|---|---|
| `node tools/repetition/simuler.mjs m2 --pour squad-2-prix` | Expérience publie `evenements-achat` v1 (jalon M2) |
| `node tools/repetition/simuler.mjs v1 --pour squad-2-prix` | Toutes publient leurs contrats en v1 et épinglent les versions actuelles |
| `node tools/repetition/simuler.mjs gate G1 --pour squad-2-prix` | GO à la gate G1, pour que l'écran commun s'anime |
| `node tools/repetition/simuler.mjs auto --pour squad-2-prix` | Pilote automatique : quand votre squad atteint une gate, les autres publient leurs livrables (Intent, contrats v1, spec, runbook) ; vous rendez leurs verdicts sur l'écran des gate keepers, comme le jour J (`--verdicts auto` pour les donner automatiquement) |
| `node tools/repetition/simuler.mjs realigner --pour squad-2-prix` | Après l'événement : elles ré-épinglent et republient, en vague |
| `node tools/repetition/simuler.mjs etat` | Versions, statuts et épinglages de tous les contrats |

`--pour` désigne la squad que vous jouez : elle n'est jamais touchée. Lancez l'outil depuis un **second clone** du Nexus
(comme si les autres squads publiaient d'ailleurs), puis faites « Mets à jour le contexte » côté starter.

Le parcours complet : `animation/je-teste-seul.md` dans le dépôt du kit.
