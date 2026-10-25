#!/usr/bin/env node
// Hook SessionStart : met l'état du hackathon dans le contexte de l'agent, sans bruit.
// La sortie standard entre dans le contexte de Claude. Toute erreur = aucune sortie.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync, spawn } from 'node:child_process';

try {
  const project = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const line = execFileSync('node', [join(project, '..', 'context-nexus', 'tools', 'hackathon-status.mjs'), '--line', '--starter', project],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 8000 }).trim();
  if (!line || line.startsWith('Statut indisponible')) process.exit(0);
  let welcomed = false;
  try { welcomed = !!JSON.parse(readFileSync(join(project, '.hackathon', 'done.json'), 'utf8')).welcomed; } catch { /* pas encore accueilli */ }
  // L'écran de la squad (port 4000) : lancé en arrière-plan, sans effet s'il tourne déjà.
  try {
    spawn('node', [join(project, '..', 'context-nexus', 'tools', 'ecran-squad.mjs'), '--starter', project], { detached: true, stdio: 'ignore', cwd: project }).unref();
  } catch { /* l'écran est un plus, jamais un blocage */ }
  console.log(`[Hackathon] ${line}.`);
  console.log('L\'écran de la squad tourne sur le port 4000 : dans un Codespace, onglet Ports, ligne 4000, icône globe ; sur un poste, http://localhost:4000. Mentionne-le si l\'utilisateur demande où voir l\'avancement.');
  console.log('Pour publier dans le Context Nexus, préfère `node ../context-nexus/tools/publish.mjs -m "<message>"` à la suite git manuelle : il montre ce qui part, ne prend que teams/<squad>/ et réessaie si quelqu\'un publie au même moment.');
  console.log(welcomed
    ? 'Si l\'utilisateur demande où il en est ou quoi faire ensuite, propose /coach.'
    : 'L\'accueil n\'a pas encore eu lieu : propose en une phrase de lancer /bienvenue ; ensuite, /coach répond à « où en est-on ? ».');
} catch {
  process.exit(0);
}
