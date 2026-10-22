# Context Nexus · dépôt partagé du dry run (26/10)

> Simulation du Context Nexus de production (bootstrap le 27/10) par un simple dépôt Git.
> Les quatre squads lisent **tout** le dépôt et n'écrivent **que** dans leur dossier `teams/<squad>/`.
>
> Kit de démarrage des squads : [Zenika-dev/ai4d-hackathon-kit](https://github.com/Zenika-dev/ai4d-hackathon-kit).
> Use case fictif (Vélora Hôtels), données 100 % synthétiques.

## Démarrer

```bash
mkdir -p ~/hackathon && cd ~/hackathon
git clone https://github.com/Zenika-dev/ai4d-hackathon-context-nexus.git context-nexus
cd context-nexus
node tools/context-assemble.mjs --squad <squad> --out ../starter-<squad>/.context/brief.md
```

Squads : `squad-1-offre`, `squad-2-prix`, `squad-3-paiement`, `squad-4-experience`. Node 20+, aucune dépendance.

## Arborescence

```
context-nexus/
  org/                         ← Nexus Org « Vélora Hôtels » : non-négociables (lecture seule)
    rules.md                   ← règles absolues, injectées en system prompt
    knowledge/conventions.md
    contracts/                 ← sécurité/PCI, accessibilité, engineering
  programme/late-checkout/     ← Nexus intermédiaire : ce que les 4 squads partagent (lecture seule)
    knowledge/                 ← brief, glossaire, règles métier, hôtels pilotes et horaires
    contracts/                 ← design d'API, composants UI communs
    operations/                ← flags, déploiement
  teams/                       ← Nexus Team : un dossier par squad (écriture par la squad owner)
    squad-1-offre/
    squad-2-prix/
    squad-3-paiement/
    squad-4-experience/
      knowledge/decision-contexts/
      intent/                  ← business-intent.md, specs/, directives/, opportunity.md, retirement.md
      contracts/               ← contrats publiés (v0 fournis par l'animation)
      operations/              ← runbook, journal de flags
  tools/context-assemble.mjs   ← simule le Context Assembler
  gabarits/                    ← gabarits des livrables G1 à G6 (à copier dans teams/<squad>/)
```

## Les quatre registres, version dry run

| Registre | Question | Ce qu'on y met pendant le dry run | Qui écrit |
|---|---|---|---|
| **Knowledge** | Ce qu'on sait | Brief, glossaire, hôtels, Decision Contexts | Humains (TL owner) |
| **Intent** | Ce qu'on veut | Business Intent Spec (G1), specs Spec Kit (G2), Opportunity (G5), Retirement (G6) | **Humains uniquement** (PO owner) |
| **Contracts** | Ce qu'on exige | Contrats d'API, règle de prix, événements, seuils vérifiables | **Humains uniquement** (TL + domaine) |
| **Operations** | Ce qu'on fait | Runbook, journal de flags, procédure de rollback (G4) | Collectif squad |

**Invariante** : l'agent peut proposer un brouillon d'Intent ou de Contracts, mais c'est un humain de la squad
qui le relit, le signe (`owner`) et le passe en `active`.

## Métadonnées obligatoires (frontmatter)

Chaque fichier `.md` des registres commence par :

```yaml
---
id: squad-2-prix/regle-prix           # identifiant stable
register: contracts                   # knowledge | intent | contracts | operations
level: team                           # org | programme | team
owner: squad-2-prix                   # rôle ou squad qui répond de l'artefact
status: active                        # draft | active | stale | deprecated | superseded
version: 0.1.0                        # semver : MAJEUR = rupture pour les consommateurs
last-validated: 2026-10-23
consumption-mode: context-injection   # system-prompt | rag | context-injection | skill
consumes: [chemin/vers/artefact.md@1.0.0, ...]   # dépendances ÉPINGLÉES (version exacte)
exception-to: null                    # chemin d'un contract parent si exception déclarée
exception-approved-by: null           # owner du niveau parent qui l'a approuvée
---
```

> Format provisoire : le format Nexus figé (alias de modèles, `task_brief_id`) est à récupérer auprès de l'équipe Plateforme.

## Cycle de vie

```
draft  → active     : relu et signé par l'owner (avant la gate)
active → stale      : posé AUTOMATIQUEMENT par context-assemble quand une dépendance épinglée a changé de version
stale  → active     : la squad relit le changement, met à jour son artefact ET son épinglage, re-signe
active → superseded : remplacé par une version plus récente (lien `supersedes`)
```

## Règles du jeu

1. On lit avant d'écrire : `node tools/context-assemble.mjs --squad <squad>` avant chaque bloc.
2. On n'écrit que dans `teams/<sa-squad>/`. Un désaccord avec le contrat d'une autre squad se règle **en parlant à cette squad**, pas en modifiant son fichier.
3. Toute publication = `version` incrémentée + `last-validated` à jour + `git pull --rebase && git push`.
4. Un changement cassant pour les consommateurs = version **majeure**.
5. Un artefact `stale` ne passe aucune gate.
