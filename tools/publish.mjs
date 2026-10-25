#!/usr/bin/env node
// publish · publier le travail de la squad dans le Context Nexus, sans se tromper et sans s'énerver.
// Depuis le dossier du starter :
//
//   node ../context-nexus/tools/publish.mjs -m "publie business-intent v1.0.0"
//
// Ce que fait l'outil, dans l'ordre : montre ce qui va être publié, ne prend QUE teams/<votre-squad>/, crée le commit,
// récupère le travail des autres (pull --rebase), publie (push). Si quelqu'un a publié au même moment (le « push rejeté »
// que 24 personnes provoquent forcément), il recommence tout seul, jusqu'à 6 fois. En cas de vrai conflit, il s'arrête
// proprement, sans rien casser, et explique quoi faire.

import { existsSync, readFileSync } from 'node:fs';
import { join, basename, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { DEFAULT_NEXUS, loadConfig, parseFrontmatter } from './lib/nexus.mjs';

function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '-m' || k === '--message') a.message = argv[++i];
    else if (k === '--squad') a.squad = argv[++i];
    else if (k === '--starter') a.starter = argv[++i];
    else if (k === '--nexus') a.nexus = argv[++i];
    else if (k === '--dry-run') a.dry = true;
    else if (k === '--help' || k === '-h') a.help = true;
  }
  return a;
}

const git = (nexus, args) => execFileSync('git', ['-C', nexus, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const errText = e => String((e && (e.stderr || e.stdout)) || (e && e.message) || e).trim();

function detectNexus(args, starter) {
  if (args.nexus) return resolve(args.nexus);
  if (process.env.NEXUS_DIR) return resolve(process.env.NEXUS_DIR);
  for (const c of [join(starter, '..', 'context-nexus'), join(starter, 'context-nexus')]) if (existsSync(join(c, 'teams'))) return resolve(c);
  return DEFAULT_NEXUS;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { console.log('Usage : node ../context-nexus/tools/publish.mjs -m "message" [--squad <squad>] [--dry-run]'); return 0; }
  const config = loadConfig();
  const starter = resolve(args.starter || process.cwd());
  let squad = args.squad || process.env.SQUAD;
  if (!squad) { const f = join(starter, '.hackathon', 'squad'); if (existsSync(f)) squad = readFileSync(f, 'utf8').trim(); }
  if (!squad) { const g = basename(starter).replace(/^starter-/, ''); if (config.squads[g]) squad = g; }
  if (!squad || !config.squads[squad]) { console.log('✗ Squad non détectée : lancez la commande depuis le dossier du starter, ou ajoutez --squad squad-1-offre.'); return 2; }
  const nexus = detectNexus(args, starter);
  const scope = `teams/${squad}`;

  // 1. Ce qui change
  const porcelain = git(nexus, ['status', '--porcelain']).split('\n').filter(Boolean).map(l => ({ code: l.slice(0, 2), path: l.slice(3).replace(/^"|"$/g, '') }));
  const mine = porcelain.filter(f => f.path.startsWith(scope + '/'));
  const others = porcelain.filter(f => !f.path.startsWith(scope + '/'));
  if (others.length) {
    console.log(`⚠ Modifié hors de ${scope}/ : non publié (on n'écrit que dans le dossier de sa squad, règle du jeu n°2) :`);
    for (const f of others.slice(0, 8)) console.log(`    ${f.path}`);
  }
  if (!mine.length) { console.log(`Rien à publier dans ${scope}/. ${others.length ? '' : 'Tout est déjà publié.'}`); return 0; }
  console.log(`Ce qui va être publié dans le Context Nexus (${scope}/) :`);
  for (const f of mine) console.log(`    ${f.code.trim() || '?'}  ${f.path}`);

  // 2. Hygiène du frontmatter (avertissements, jamais bloquants)
  for (const f of mine.filter(f => f.path.endsWith('.md') && existsSync(join(nexus, f.path)))) {
    const text = readFileSync(join(nexus, f.path), 'utf8');
    const fm = parseFrontmatter(text);
    if (!fm) { if (!/journal/.test(f.path)) console.log(`⚠ ${f.path} : pas de frontmatter (id, version, status, owner…).`); continue; }
    if (/^</.test(String(fm.meta.owner || ''))) console.log(`⚠ ${f.path} : owner pas encore renseigné.`);
    if (fm.meta.status === 'draft' && ['contracts', 'intent'].includes(fm.meta.register)) console.log(`⚠ ${f.path} : encore en draft (un humain doit le relire et le passer en active avant la gate).`);
    if (fm.meta.status === 'stale') console.log(`⚠ ${f.path} : encore stale : relisez le changement, mettez à jour l'épinglage, repassez-le en active.`);
  }
  if (args.dry) { console.log('(essai à blanc : rien n\'est publié)'); return 0; }

  // 3. Commit de ce périmètre et de lui seul
  const message = args.message ? `${squad}: ${args.message.replace(new RegExp('^' + squad + '\\s*:\\s*'), '')}` : `${squad}: publie ${mine.length} fichier(s)`;
  const retryLock = async fn => {
    for (let i = 1; ; i++) {
      try { return fn(); } catch (e) {
        if (i < 6 && /index\.lock|another git process/i.test(errText(e))) { await sleep(200 + Math.floor(Math.random() * 600)); continue; }
        throw e;
      }
    }
  };
  try {
    await retryLock(() => git(nexus, ['add', '--', scope]));
    await retryLock(() => git(nexus, ['commit', '-m', message, '--', scope]));
  } catch (e) { console.log(`✗ Commit impossible : ${errText(e).split('\n')[0]}\n  Si Git demande qui vous êtes : git config --global user.name "Prénom Nom"`); return 1; }
  console.log(`✓ Commit : ${message}`);

  // 4. Récupérer, puis publier ; recommencer si quelqu'un a publié au même moment
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      git(nexus, ['pull', '--rebase', '--autostash', '--quiet']);
    } catch (e) {
      try { git(nexus, ['rebase', '--abort']); } catch { /* pas de rebase en cours */ }
      console.log(`✗ Conflit en récupérant le travail des autres : ${errText(e).split('\n').filter(l => /CONFLICT|conflict/i.test(l)).slice(0, 3).join(' | ') || errText(e).split('\n')[0]}`);
      console.log(`  Rien n'est cassé : votre commit est gardé en local. Quelqu'un a modifié un fichier de ${scope}/ en même temps que vous.`);
      console.log('  Demandez à Claude : « Il y a un conflit en publiant dans le Context Nexus, aide-moi à le résoudre. »');
      return 1;
    }
    try {
      git(nexus, ['push', '--quiet']);
      const head = git(nexus, ['rev-parse', '--short', 'HEAD']).trim();
      console.log(`✓ Publié dans le Context Nexus (${head})${attempt > 1 ? `, après ${attempt} essais : quelqu'un publiait au même moment` : ''}.`);
      console.log('  Les autres squads récupèrent vos changements avec : « Mets à jour le contexte. »');
      return 0;
    } catch (e) {
      if (attempt === 6) { console.log(`✗ Publication refusée 6 fois : ${errText(e).split('\n')[0]}\n  Votre commit est gardé en local. Vérifiez le réseau, puis relancez la même commande.`); return 1; }
      await sleep(300 + Math.floor(Math.random() * 900));
    }
  }
  return 1;
}

main().then(code => process.exit(code)).catch(e => { console.log(`✗ ${e.message}`); process.exit(1); });
