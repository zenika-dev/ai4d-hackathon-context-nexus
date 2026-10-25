#!/usr/bin/env node
// hackathon-status · où en est la squad, que manque-t-il pour la gate, quelle est la prochaine étape ?
// Lancé depuis le dossier du starter (là où l'on lance claude) :
//
//   node ../context-nexus/tools/hackathon-status.mjs              # état lisible (utilisé par /coach)
//   node ../context-nexus/tools/hackathon-status.mjs --welcome    # accueil complet (utilisé par /bienvenue)
//   node ../context-nexus/tools/hackathon-status.mjs --line       # une ligne (hooks, barre d'état)
//   node ../context-nexus/tools/hackathon-status.mjs --json       # état complet pour un tableau de bord
//   node ../context-nexus/tools/hackathon-status.mjs --mark analyze   # coche une étape que rien ne prouve dans les fichiers
//
// Ne modifie rien d'autre que .hackathon/done.json (option --mark). Sort toujours avec le code 0 :
// les skills qui l'appellent ne doivent jamais échouer à cause de lui.

import { existsSync, readFileSync } from 'node:fs';
import { join, basename, resolve } from 'node:path';
import { DEFAULT_NEXUS, loadConfig } from './lib/nexus.mjs';
import { computeStatus, renderText, renderLine, environmentChecks, writeMark } from './lib/status.mjs';

function parseArgs(argv) {
  const a = { mode: 'text' };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--squad') a.squad = argv[++i];
    else if (k === '--starter') a.starter = argv[++i];
    else if (k === '--nexus') a.nexus = argv[++i];
    else if (k === '--config') a.config = argv[++i];
    else if (k === '--now') a.now = argv[++i];
    else if (k === '--mark') a.mark = argv[++i];
    else if (k === '--json') a.mode = 'json';
    else if (k === '--line') a.mode = 'line';
    else if (k === '--welcome') a.mode = 'welcome';
    else if (k === '--help' || k === '-h') a.help = true;
  }
  return a;
}

function detectSquad(args, starter, config) {
  if (args.squad) return args.squad;
  if (process.env.SQUAD) return process.env.SQUAD;
  const f = join(starter, '.hackathon', 'squad');
  if (existsSync(f)) return readFileSync(f, 'utf8').trim();
  const guess = basename(resolve(starter)).replace(/^starter-/, '');
  return config.squads[guess] ? guess : null;
}

function detectNexus(args, starter) {
  if (args.nexus) return resolve(args.nexus);
  if (process.env.NEXUS_DIR) return resolve(process.env.NEXUS_DIR);
  for (const c of [join(starter, '..', 'context-nexus'), join(starter, 'context-nexus')]) if (existsSync(join(c, 'teams'))) return resolve(c);
  return DEFAULT_NEXUS;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log('Usage : node hackathon-status.mjs [--welcome|--line|--json] [--squad <squad>] [--starter <dossier>] [--nexus <dossier>] [--mark <étape>]');
    return;
  }
  const config = loadConfig(args.config);
  const starter = resolve(args.starter || process.cwd());
  const squad = detectSquad(args, starter, config);
  if (!squad) {
    console.log('Statut indisponible : squad non détectée. Lancez la commande depuis le dossier du starter (starter-squad-…), ou ajoutez --squad squad-1-offre.');
    return;
  }
  const nexus = detectNexus(args, starter);
  if (args.mark) {
    writeMark(starter, args.mark);
    console.log(`Étape « ${args.mark} » cochée dans .hackathon/done.json`);
    return;
  }
  const now = args.now ? new Date(args.now) : new Date();
  const status = computeStatus({ nexus, starter, squad, config, now });
  if (args.mode === 'json') {
    status.env = environmentChecks({ nexus, starter, squad });
    console.log(JSON.stringify(status, null, 2));
  } else if (args.mode === 'line') {
    console.log(renderLine(status));
  } else {
    console.log(renderText(status, { welcome: args.mode === 'welcome', config }));
    if (args.mode === 'welcome') {
      console.log('\nVÉRIFICATIONS DE L\'ENVIRONNEMENT :');
      for (const c of environmentChecks({ nexus, starter, squad })) console.log(`  ${c.ok ? '[x]' : '[ ]'} ${c.id} : ${c.detail}`);
    }
  }
}

try {
  main();
} catch (e) {
  console.log(`Statut indisponible : ${e.message}`);
}
