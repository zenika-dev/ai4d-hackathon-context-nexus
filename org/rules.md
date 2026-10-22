---
id: org/rules
register: knowledge
level: org
owner: architecture-platform
status: active
version: 1.0.0
last-validated: 2026-10-21
consumption-mode: system-prompt
---

# Règles absolues · Vélora Hôtels (société fictive)

Ces règles sont injectées dans le system prompt de tous les agents. Elles n'ont pas d'exception.

1. Aucune donnée réelle : toutes les données manipulées sont synthétiques. Aucun nom de client, aucune carte, aucun e-mail réel.
2. Aucun numéro de carte (PAN), CVV ou date d'expiration ne transite, n'est journalisé ni stocké par nos services. Le paiement passe par le PSP fictif `PayVel` et un jeton.
3. Toute fonctionnalité nouvelle est livrée derrière un feature flag, désactivé par défaut. Toute bascule de flag est tracée dans le journal de flags (qui, quand, pourquoi).
4. Les dates et heures sont en ISO 8601 avec fuseau (`2026-11-02T14:00:00+01:00`). L'heure locale de l'hôtel fait foi pour un horaire de départ.
5. Les contrats d'API publiés dans le Context Nexus font foi. Le code s'aligne sur le contrat, jamais l'inverse sans republication du contrat.
6. L'agent ne modifie jamais un artefact `intent/` ou `contracts/` sans relecture humaine. Il propose, un humain signe.
7. Un artefact au statut `stale` ne sert pas de base à du code nouveau tant qu'il n'est pas revalidé.
