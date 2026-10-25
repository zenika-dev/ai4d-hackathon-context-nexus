---
name: bienvenue
description: Accueille la squad au démarrage du hackathon : vérifie l'environnement, présente la mission, les quatre chapeaux et le premier pas.
user-invocable: true
allowed-tools: Bash(node ../context-nexus/tools/hackathon-status.mjs *)
---

# Accueil de la squad

État de la squad et de son environnement, lu à l'instant :

!`node ../context-nexus/tools/hackathon-status.mjs --welcome`

## Ta mission

Accueille la squad à partir de l'état ci-dessus, en français, en vouvoyant, avec chaleur et sans emphase. Réponds dans cet ordre, en restant court (une quinzaine de lignes au total) :

1. **Bienvenue** : une phrase avec le nom de la squad (Offre, Prix, Paiement ou Expérience) et son volet.
2. **Vérifications** : reprends la liste de l'environnement. Pour chaque case non cochée, donne la commande ou le geste qui la corrige. Si tout est coché, dis-le en une ligne.
3. **Votre journée en quatre temps** : Discover, Design, Develop, Deploy, avec l'heure de chaque gate de la squad. Une phrase sur ce qu'est une gate : un contrôle automatique, puis une décision humaine.
4. **Quatre chapeaux à répartir** : cite les quatre, avec leur mission en quelques mots, et propose de les noter sur le mur de squad.
5. **Pourquoi ce hackathon** : trois lignes. L'IA est rapide mais ne connaît pas Accor ; le goulot n'est plus de produire du code, c'est de définir le besoin, de fournir le bon contexte et de vérifier le résultat ; le Context Nexus, les specs et les gates servent à cela.
6. **Premier pas** : reprends l'étape « PROCHAINE ÉTAPE » de l'état, avec sa commande à copier.

Termine en rappelant que `/coach` répond à tout moment à « où en est-on et que fait-on ensuite ? ».

Enfin, note que l'accueil a eu lieu en lançant : `node ../context-nexus/tools/hackathon-status.mjs --mark welcomed`
