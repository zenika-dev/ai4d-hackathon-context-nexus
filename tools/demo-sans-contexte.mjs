#!/usr/bin/env node
// demo-sans-contexte · la démonstration d'ouverture : le même prompt, sans puis avec le contexte du Nexus.
// En 3 minutes, on voit ce que le Context Nexus change : l'agent cesse d'inventer.
//
//   node tools/demo-sans-contexte.mjs --squad squad-3-paiement            # prépare le dossier « sans contexte » et affiche le mode d'emploi
//   node tools/demo-sans-contexte.mjs --squad squad-3-paiement --run      # lance les deux réponses et les affiche l'une sous l'autre
//
// « Avec contexte » = le dossier du starter (CLAUDE.md, brief assemblé, garde-fous). À lancer depuis ce dossier,
// ou avec --starter <dossier>. L'option --run consomme quelques milliers de tokens.

import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { loadConfig } from './lib/nexus.mjs';

const args = process.argv.slice(2);
const opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const config = loadConfig();
const starter = resolve(opt('--starter') || process.cwd());
const guess = basename(starter).replace(/^starter-/, '');
const squad = opt('--squad') || (config.squads[guess] ? guess : null);
if (!squad || !config.squads[squad]) {
  console.log('Squad non détectée : ajoutez --squad squad-1-offre (ou squad-2-prix, squad-3-paiement, squad-4-experience).');
  process.exit(0);
}
const cfg = config.squads[squad];
const dir = join(tmpdir(), 'hackathon-sans-contexte', squad);
mkdirSync(dir, { recursive: true });
if (!existsSync(join(dir, '.git'))) { try { execFileSync('git', ['init', '-q'], { cwd: dir }); } catch { /* git absent : le dossier suffit */ } }
writeFileSync(join(dir, 'README.md'), '# Dossier vide\n\nAucun contexte Vélora ici : pas de CLAUDE.md, pas de brief, pas de contrats.\n');
const prompt = `${cfg.demoPrompt} N'écris aucun fichier : affiche le code dans ta réponse, en 25 lignes au plus.`;

console.log(`Squad ${cfg.number} · ${cfg.label}\n`);
console.log(`Prompt : ${cfg.demoPrompt}\n`);
console.log('SANS contexte  :  cd "' + dir + '"  puis  claude');
console.log(`AVEC contexte  :  cd "${starter}"  puis  claude`);
console.log(`\nÀ regarder : ${cfg.demoWatch}\n`);

if (args.includes('--run')) {
  for (const [titre, cwd] of [['SANS contexte', dir], ['AVEC contexte', starter]]) {
    console.log(`\n===== ${titre} =====\n`);
    try {
      console.log(execFileSync('claude', ['-p', prompt, '--max-turns', '10', '--output-format', 'text'], { cwd, encoding: 'utf8', timeout: 300000, stdio: ['ignore', 'pipe', 'pipe'] }).trim());
    } catch (e) {
      const out = String(e.stdout || '').trim();
      const err = String(e.stderr || e.message).split('\n').filter(l => l && !l.startsWith('Ignoring')).slice(0, 2).join(' · ');
      console.log(out || `(réponse indisponible : ${err})`);
    }
  }
}
