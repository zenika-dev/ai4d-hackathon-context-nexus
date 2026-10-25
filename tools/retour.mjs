#!/usr/bin/env node
// retour · la fiche de retour de la squad, publiée dans le Context Nexus (teams/<squad>/operations/retours.md).
// Après chaque gate (une question, 20 secondes) et en fin de session. Lecture par squad, jamais par personne :
// les retours alimentent le learning report du TOM. Lancé par Claude depuis le dossier du starter :
//
//   node ../context-nexus/tools/retour.mjs G1 --clarte claire|partielle|floue [--flou "G1-5 …"] [--note "…"]
//   node ../context-nexus/tools/retour.mjs FIN --rythme oui|en-partie|non --cadrage … --gates … --criteres …
//        --responsabilites … --contexte … --8h … [--changer "…"] [--garder "…"] [--terrain "…"]
//   --terrain : le moment où la squad s'est dit « ce n'est pas comme chez nous » (écart avec le terrain Accor).

import { existsSync, readFileSync, writeFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { execFileSync } from 'node:child_process';
import { DEFAULT_NEXUS, loadConfig, isoNow, gateVerdicts } from './lib/nexus.mjs';

const argv = process.argv.slice(2);
const kind = String(argv[0] || '').toUpperCase();
const opt = k => { const i = argv.indexOf(`--${k}`); return i >= 0 ? String(argv[i + 1] || '').replace(/[|\n\r]/g, ' ').trim().slice(0, 200) : ''; };
const config = loadConfig();
const starter = resolve(opt('starter') || process.cwd());
const squad = (() => {
  try { return readFileSync(join(starter, '.hackathon', 'squad'), 'utf8').trim(); } catch { /* déduite du nom */ }
  return basename(starter).replace(/^starter-/, '');
})();
const nexus = resolve(opt('nexus') || DEFAULT_NEXUS);
const CLARTE = ['claire', 'partielle', 'floue'];
const ECHELLE = ['oui', 'en-partie', 'non'];
const FIN = ['rythme', 'cadrage', 'gates', 'criteres', 'responsabilites', 'contexte', '8h'];

function fail(m) { console.error(`✗ ${m}`); process.exit(1); }

if (!config.squads[squad]) fail(`Squad non reconnue (« ${squad} ») : lancez depuis le dossier du starter.`);
let row;
if (/^G[1-6]$/.test(kind)) {
  const clarte = opt('clarte');
  if (!CLARTE.includes(clarte)) fail(`--clarte : ${CLARTE.join(', ')}`);
  const v = gateVerdicts(nexus, squad)[kind];
  row = [isoNow(), kind, v ? v.verdict : '—', `critères : ${clarte}`, opt('flou') || '—', opt('note') || '—'];
} else if (kind === 'FIN') {
  const answers = FIN.map(k => { const a = opt(k); if (!ECHELLE.includes(a)) fail(`--${k} : ${ECHELLE.join(', ')}`); return `${k} : ${a}`; });
  if (opt('terrain')) answers.push(`pas comme chez nous : ${opt('terrain')}`);
  row = [isoNow(), 'FIN', '—', answers.join(' · '), opt('changer') || '—', opt('garder') || '—'];
} else {
  fail('Usage : retour.mjs G1 --clarte claire|partielle|floue [--flou "…"] [--note "…"]   ou   retour.mjs FIN --rythme … (voir l\'en-tête)');
}

const dir = join(nexus, 'teams', squad, 'operations');
const file = join(dir, 'retours.md');
mkdirSync(dir, { recursive: true });
if (!existsSync(file)) {
  writeFileSync(file, `# Fiches de retour · ${squad}\n\nAprès chaque gate et en fin de session. Lecture par squad, jamais par personne : ces retours alimentent le learning report du TOM.\n\n| Date | Gate | Verdict | Réponses | Critère flou / à changer | Note / à garder |\n|---|---|---|---|---|---|\n`);
}
appendFileSync(file, `| ${row.join(' | ')} |\n`);
console.log(`✓ Fiche de retour ${kind} enregistrée (${row[3]})`);

// On ne publie QUE la fiche de retour : le travail en cours de la squad reste chez elle tant qu'elle ne le publie pas.
const git = (...a) => execFileSync('git', ['-C', nexus, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 });
const rel = `teams/${squad}/operations/retours.md`;
try {
  git('add', '--', rel);
  git('commit', '-q', '-m', `${squad}: fiche de retour ${kind}`, '--', rel);
  let ok = false;
  for (let i = 0; i < 6 && !ok; i++) {
    try { git('pull', '--rebase', '--autostash', '-q'); git('push', '-q'); ok = true; } catch { /* quelqu'un a publié en même temps : on recommence */ }
  }
  console.log(ok ? '✓ Publiée dans le Context Nexus' : 'La fiche est enregistrée mais pas encore publiée : demandez « Publie nos changements ».');
} catch (e) {
  console.log('La fiche est enregistrée mais pas encore publiée : demandez « Publie nos changements ».');
}
