# Outils du hackathon

Sans dépendance, Node 20 ou plus. Les commandes se lancent depuis le dossier du starter (là où l'on lance `claude`) ; le Nexus est alors à `../context-nexus`.

| Outil | Pour qui | Rôle |
|---|---|---|
| `context-assemble.mjs` | squads | Assemble le contexte de la squad (`.context/brief.md`), détecte et marque les artefacts `stale` |
| `hackathon-status.mjs` | squads, coach | État de la squad : phase, critères de la prochaine gate, prochaine étape avec sa commande. Alimente `/coach`, `/bienvenue`, la barre d'état et les hooks |
| `publish.mjs` | squads | Publie le travail de la squad dans le Nexus : montre ce qui part, ne prend que `teams/<squad>/`, réessaie si quelqu'un publie au même moment |
| `overlay/apply-overlay.mjs` | Codespace, squads | Pose dans le starter le style « coach-pdlc », `/bienvenue`, `/coach`, les garde-fous et les permissions sûres. Appelé par `post-create.sh` |
| `ecran-squad.mjs` | squads | Écran de la squad (port 4000) : l'écran commun en lecture seule et un panneau « Votre squad » (prochaine étape, phrase à dire à Claude, critères de la gate). Lancé par le hook de début de session |
| `nexus-board.mjs` | animation | Écran commun de la salle ; avec `--keeper`, poste des gate keepers (verdicts, événement) |
| `event.mjs` | animation | L'événement scripté du Develop : `list`, `card`, `apply`, `undo` |
| `demo-sans-contexte.mjs` | animation | Démo d'ouverture : le même prompt, sans puis avec le contexte du Nexus |
| `repetition/simuler.mjs` | animation | Répétition en solo : joue les trois autres squads (publications v1, verdicts, réalignement) sur un Nexus de répétition |

Réglages (horaires, créneaux, jalons communs, prompts de démo) : `hackathon.config.json`. Guide d'animation : `animation/ecran-commun.md` dans le dépôt du kit.

`hackathon-status.mjs` n'est pas le gate-check officiel : il explique et oriente, le verdict automatique reste `npm run gate-check`.
