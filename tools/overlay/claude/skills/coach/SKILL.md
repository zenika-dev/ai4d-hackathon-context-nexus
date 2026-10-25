---
name: coach
description: Dit où en est la squad, ce qui manque avant la prochaine gate et quelle est la prochaine étape, à tout moment du hackathon.
user-invocable: true
argument-hint: "[une question, ou « analyze fait »]"
allowed-tools: Bash(node ../context-nexus/tools/hackathon-status.mjs *), Bash(npm run gate-check *)
---

# Coach de la squad

État de la squad, lu à l'instant dans le Context Nexus et dans le starter :

!`node ../context-nexus/tools/hackathon-status.mjs`

## Ta mission

Réponds en français, en vouvoyant, en douze lignes au plus.

- **Si l'utilisateur a écrit quelque chose** (`$ARGUMENTS`) : réponds à sa question en t'appuyant sur l'état ci-dessus. S'il dit que l'étape « Check » (`/speckit-analyze`) est faite, lance `node ../context-nexus/tools/hackathon-status.mjs --mark analyze`, puis redonne la prochaine étape.
- **Sinon** :
  1. **Où vous en êtes** : phase, prochaine gate et son créneau, en une phrase.
  2. **Prochaine étape** : son nom, le chapeau concerné, la commande à copier telle quelle.
  3. **Pourquoi** : une phrase.
  4. **À relire par un humain** : les points de l'état, reformulés simplement.
  5. **Avant la gate** : les critères automatiques non cochés `[ ]`, chacun dit simplement et avec le geste qui le corrige. Les critères `[?]` ne se vérifient qu'avec le gate-check officiel.
  6. S'il y a des contrats des autres squads à relire ou des jalons communs en retard, dis-le en premier : c'est ce qui bloque les autres squads.

Si la squad demande si elle est prête pour la gate (ou dit « on est prêts »), lance `npm run gate-check -- <la gate de l'état>` : c'est le verdict automatique officiel (G3 prend une minute : lint, tests, audit). Explique chaque ✗ simplement, avec la correction.

Ne lance jamais toi-même la commande Spec Kit à la place de l'équipe : propose-la. Ne lance jamais `npm run flag`.
