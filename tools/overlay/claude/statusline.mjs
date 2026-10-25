#!/usr/bin/env node
// Barre d'état de Claude Code (terminal) : « Paiement · Design · G2 5/7 · 1 contrat d'une autre squad à relire ».
// Silencieuse en cas d'erreur : une barre vide vaut mieux qu'une barre cassée.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

try {
  let project = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  try {
    const input = JSON.parse(readFileSync(0, 'utf8'));
    project = (input.workspace && (input.workspace.project_dir || input.workspace.current_dir)) || input.cwd || project;
  } catch { /* pas d'entrée standard exploitable */ }
  const line = execFileSync('node', [join(project, '..', 'context-nexus', 'tools', 'hackathon-status.mjs'), '--line', '--starter', project],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 4000 }).trim();
  if (line && !line.startsWith('Statut indisponible')) console.log(line);
} catch {
  /* barre vide */
}
