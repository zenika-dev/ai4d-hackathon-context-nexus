---
name: bienvenue
description: Accueille la squad au démarrage du hackathon : le contexte d'ensemble, sa place dans le sujet, la journée, les responsabilités, où sont les fichiers, puis la première action à faire.
user-invocable: true
allowed-tools: Bash(node ../context-nexus/tools/hackathon-status.mjs *)
---

# Accueil de la squad

État de la squad et de son environnement, lu à l'instant :

!`node ../context-nexus/tools/hackathon-status.mjs --welcome`

## Ta mission

Accueille la squad en français, en vouvoyant, avec chaleur et sans emphase. Les participants découvrent le PDLC : va du général au particulier, en phrases simples, sans jargon non expliqué.

**La mise en page compte autant que le contenu** : c'est le premier message que la squad lit. Reproduis exactement la structure ci-dessous : un titre `##`, des sections `###`, **une ligne vide avant et après chaque titre, chaque paragraphe et chaque liste**, des listes à puces plutôt que des paragraphes, au plus trois phrases par paragraphe. Pas de tableau (le panneau Claude est étroit). Remplace chaque `<…>` par ce que dit l'état ; ne recopie pas les consignes entre parenthèses.

**Deux « coach » à ne pas confondre** : « coach » désigne uniquement la commande `/coach` dans Claude. La personne de l'équipe programme AI4D assise avec la squad s'appelle **votre animateur AI4D**, jamais « votre coach ».

**Chaque fichier ou dossier cité porte son chemin**, entre accents graves, tel qu'il apparaît dans l'explorateur de fichiers, à gauche : `context-nexus/…` pour le Context Nexus (jamais `../context-nexus`), `specs/…` ou `.context/brief.md` pour le starter. Reprends les chemins de l'état (« VOTRE SQUAD PUBLIE », « ELLE LIT », « OÙ SONT LES FICHIERS ») ; n'en invente aucun.

---

## Bienvenue dans la squad <numéro> · <nom>

### Le hackathon en trois phrases

Vélora Hôtels (société fictive) veut vendre le late check-out en ligne, après la réservation. Quatre squads (Offre, Prix, Paiement, Expérience) construisent chacune un volet, et chacune dépend des autres. L'IA écrit vite, mais elle ne connaît ni Vélora ni les décisions des autres squads : on définit le besoin, on lui donne le bon contexte, et on vérifie à chaque gate.

### Votre squad

<son volet en une phrase simple, dit à la squad : « Vous … »>

- **Vous publiez** <(une sous-puce par contrat de « VOTRE SQUAD PUBLIE »)> :
  - `<nom>` : `<chemin>`
- **Vous lisez** <(une sous-puce par contrat de « ELLE LIT »)> :
  - `<nom>` (<à qui il appartient>) : `<chemin>`
- **Pourquoi ça compte :** les autres squads construisent sur vos contrats. <une phrase propre à la squad : ce qui doit rester cohérent avec les autres squads>

### Votre journée

<une ligne par phase de « JOURNÉE DE VOTRE SQUAD », sans la pause ni le bonus, exactement sous cette forme :>
- **<heure début> – <heure fin> · <n>. <Phase>** → <ce qu'on en sort, en quelques mots> · gate **<Gx> à <heure>**

Une **gate** clôt chaque phase : un contrôle automatique, puis la décision d'une personne, le gate keeper, qui passe à votre table à l'heure du créneau.

### Vos responsabilités

Le TOM ne crée pas de nouveaux postes : il confie des responsabilités à vos profils actuels. Vous les apprenez aujourd'hui en les exerçant.

- **Context Engineer** : <quelques mots>
- **Specification Engineer** : <quelques mots>
- **Agentic Workflow Orchestrator** : <quelques mots>
- **Decision Guarantor** : <quelques mots>

**Mettez-vous d'accord maintenant, à l'oral,** sur qui porte laquelle (à six, deux sont portées à deux). À chaque étape, `/coach` vous dira laquelle est en jeu et ce qu'elle fait.

### Où sont les fichiers

Tout se trouve dans l'explorateur de fichiers, à gauche de l'éditeur. Le Context Nexus, partagé par les quatre squads, y est le dossier `context-nexus/`.

- **Votre dossier dans le Nexus :** `context-nexus/teams/<squad>/`
- **Les faits, les règles, les décisions déjà prises :** `context-nexus/programme/late-checkout/knowledge/`
- **Les règles de l'organisation :** `context-nexus/org/` · **les gabarits :** `context-nexus/gabarits/`
- **Votre spec, votre plan et vos tâches (Design) :** `specs/`

### Vous commencez par Discover

Phase 1 sur 4 : comprendre le besoin et le chiffrer, avant toute solution. Vous en sortez avec la **Business Intent Spec**, que Claude va créer dans `context-nexus/teams/<squad>/intent/business-intent.md`. Gate G1 à <heure>.

Où trouver les réponses (c'est ce que le Discover fait pratiquer) :

- **Le Context Nexus** : les faits, les règles et les décisions déjà prises, dont `context-nexus/programme/late-checkout/knowledge/decisions-deja-prises.md`. Claude les lit et les cite.
- **La Direction Revenu Annexe**, cliente du projet, jouée par votre animateur AI4D : son ambition chiffrée, l'horizon, la priorité. Ce sont ses décisions, écrites nulle part : allez les lui demander, elle ne répond qu'aux questions posées.
- **Votre squad** : le seuil sur lequel vous vous engagez, l'owner, ce que vous ne faites pas. Vous décidez et signez.

### Vos outils

- **Votre animateur AI4D**, la personne de l'équipe programme AI4D assise avec votre squad : il anime votre table, joue la Direction Revenu Annexe et vous débloque si besoin.
- **/coach**, le coach dans Claude, chaque fois que vous vous demandez quoi faire : où vous en êtes, le fichier à ouvrir, la prochaine phrase à taper.
- **L'écran de votre squad**, l'onglet ouvert à côté de l'éditeur (sinon onglet **Ports**, ligne 4000, icône globe) : votre prochaine étape, vos critères de gate, l'état des contrats de toutes les squads.
- **Une nouvelle session Claude** à chaque nouvelle phase, après chaque gate : l'agent repart d'un contexte propre et du brief à jour, et la session coûte moins. `/coach` vous dira quand.
- **La fiche de retour**, après chaque gate (20 secondes) et en fin de session : vos retours font évoluer le TOM. `/coach` vous la demandera.

---

> **À vous :** tapez dans Claude, ou copiez :
>
> « <la phrase « À TAPER DANS CLAUDE » de l'état> »

---

Fin de la structure. Deux cas particuliers :

- **Environnement** : n'en parle pas s'il est prêt. S'il y a une ligne « ENVIRONNEMENT À CORRIGER », ajoute juste avant « À vous » une section `### Avant de commencer` qui dit en une ou deux lignes ce qui ne va pas, et propose de le corriger toi-même.
- Si l'étape de l'état n'est pas celle du Discover (squad déjà avancée), garde la section « Vous commencez par … » avec la phase réelle, son livrable et son chemin (« FICHIERS DE L'ÉTAPE »).

Ne lance aucune autre commande. Ne fais pas l'étape à la place de la squad : attends qu'elle tape la phrase.

Enfin, note que l'accueil a eu lieu en lançant : `node ../context-nexus/tools/hackathon-status.mjs --mark welcomed`
