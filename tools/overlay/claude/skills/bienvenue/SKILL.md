---
name: bienvenue
description: Accueille la squad au démarrage du hackathon : le contexte d'ensemble, sa place dans le sujet, la journée, les responsabilités, puis la première action à faire.
user-invocable: true
allowed-tools: Bash(node ../context-nexus/tools/hackathon-status.mjs *)
---

# Accueil de la squad

État de la squad et de son environnement, lu à l'instant :

!`node ../context-nexus/tools/hackathon-status.mjs --welcome`

## Ta mission

Accueille la squad en français, en vouvoyant, avec chaleur et sans emphase. Les participants découvrent le PDLC : va du général au particulier, en phrases simples. Une vingtaine de lignes au plus, avec des titres courts en gras. Dans cet ordre :

1. **Le hackathon en trois phrases** : Vélora Hôtels (société fictive) veut vendre le late check-out en ligne ; quatre squads construisent chacune un volet et dépendent les unes des autres ; l'IA écrit vite mais ne connaît ni Vélora ni ce que décident les autres équipes : on va donc définir le besoin, donner le bon contexte et vérifier, avec des gates. Pas de jargon non expliqué.
2. **Votre squad** : son nom et son volet en une phrase simple, puis ce qu'elle publie pour les autres squads et ce qu'elle lit chez elles (ligne « VOTRE SQUAD PUBLIE »), et pourquoi ça compte : les autres squads construisent sur vos contrats.
3. **Votre journée** : les quatre phases du PDLC, chacune en une ligne avec son heure et sa gate (reprends « LE PDLC » et « JOURNÉE DE VOTRE SQUAD »). Une phrase sur ce qu'est une gate : un contrôle automatique, puis la décision d'une personne, le gate keeper, qui passe vous voir à l'heure du créneau.
4. **Vos responsabilités** : dis que le TOM ne crée pas de nouveaux postes mais des responsabilités, portées par les profils existants, et qu'on les apprend en les exerçant aujourd'hui. Cite les quatre, chacune en quelques mots (Context Engineer, Specification Engineer, Agentic Workflow Orchestrator, Decision Guarantor). Demande à la squad de **se mettre d'accord maintenant, à l'oral,** sur qui porte laquelle (à six, deux sont portées à deux), et précise que le coach dira, à chaque étape, quelle responsabilité est en jeu et ce qu'elle fait. Ne parle d'aucun mur ni d'aucun support physique.
5. **Environnement** : n'en parle pas s'il est prêt. S'il y a une ligne « ENVIRONNEMENT À CORRIGER », dis seulement ce qui ne va pas et propose de le corriger toi-même.
6. **Vous commencez par Discover** : dis clairement que la squad entre dans la phase 1 du PDLC, son objectif et ce qu'on en sort (la Business Intent Spec), et l'heure de la gate G1. Ajoute **où trouver les réponses**, en trois lignes, car c'est ce que le Discover fait pratiquer :
   - **le Context Nexus** : les faits, les règles et les décisions déjà prises (brief, règles métier, `decisions-deja-prises.md`, contrats). Claude les lit et les cite ;
   - **la Direction Revenu Annexe**, cliente du projet, jouée par votre coach : son ambition chiffrée, l'horizon, la priorité. Ce sont ses décisions, écrites nulle part : allez les lui demander, elle ne répond qu'aux questions posées ;
   - **votre squad** : le seuil sur lequel vous vous engagez, l'owner, ce que vous ne faites pas. Vous décidez et signez.
7. **À vous maintenant** : termine par un encadré d'action, exactement sous cette forme :

   > **À vous :** tapez dans Claude, ou copiez :
   > « (la phrase « À TAPER DANS CLAUDE » de l'état) »

   Puis **vos trois outils**, une ligne chacun :
   - **/coach**, à chaque fois que vous vous demandez quoi faire : où vous en êtes, ce que vous apprenez, la prochaine phrase à taper ;
   - **l'écran de votre squad**, l'onglet ouvert à côté de l'éditeur (sinon onglet **Ports**, ligne 4000, icône globe) : votre prochaine étape, vos critères de gate, et l'état des contrats de toutes les squads ;
   - **une nouvelle session Claude** à chaque nouvelle phase (après chaque gate) : l'agent repart d'un contexte propre et du brief à jour, et la session coûte moins. Le coach vous dira quand.
   - **la fiche de retour**, après chaque gate (20 secondes) et en fin de session : vos retours de squad font évoluer le TOM. Le coach vous la demandera.

Ne lance aucune autre commande. Ne fais pas l'étape à la place de la squad : attends qu'elle tape la phrase.

Enfin, note que l'accueil a eu lieu en lançant : `node ../context-nexus/tools/hackathon-status.mjs --mark welcomed`
