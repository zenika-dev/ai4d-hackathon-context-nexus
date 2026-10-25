#!/usr/bin/env node
// event · l'événement scripté du hackathon : « un contrat d'une autre squad change pendant le Develop ».
// Réservé à l'animation. À répéter avant le jour J sur une copie du Nexus (option --no-commit, puis undo).
//
//   node tools/event.mjs list
//   node tools/event.mjs card 01-regle-prix-v2          # la carte à lire ou à afficher (aucune écriture)
//   node tools/event.mjs apply 01-regle-prix-v2 --push  # applique, commit, publie
//   node tools/event.mjs undo 01-regle-prix-v2 --push   # annule (répétition)
//
// L'événement est volontairement chirurgical : il ne touche, dans le contrat de la squad concernée, que la ligne
// `version`, la ligne `last-validated` et la fin du fichier (une section « Changement »). Le risque de conflit Git
// avec le travail de la squad est donc minimal.

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, realpathSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { TOOLS_DIR, DEFAULT_NEXUS, parseFrontmatter, major, cmpVersion } from './lib/nexus.mjs';

const EVENTS = join(TOOLS_DIR, 'events');
const STATE = join(TOOLS_DIR, '.events-state');

function parseArgs(argv) {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--nexus') a.nexus = argv[++i];
    else if (k === '--push') a.push = true;
    else if (k === '--no-commit') a.noCommit = true;
    else if (k === '--force') a.force = true;
    else a._.push(k);
  }
  return a;
}

const git = (nexus, args) => execFileSync('git', ['-C', nexus, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const loadEvent = id => JSON.parse(readFileSync(join(EVENTS, id, 'event.json'), 'utf8'));
const today = () => new Date().toISOString().slice(0, 10);

function list() {
  for (const id of readdirSync(EVENTS).filter(n => existsSync(join(EVENTS, n, 'event.json')))) {
    const e = loadEvent(id);
    console.log(`${id} · ${e.title}`);
  }
}

function card(id) {
  const e = loadEvent(id);
  console.log(`ÉVÉNEMENT · ${e.title}\n\nÀ lire à voix haute, sans commentaire :\n${e.say || e.announce}\n\nPour l'animation (à ne pas lire) : ${e.announce}\n\nCe que les squads doivent faire : lire le changement (git -C ../context-nexus log -p -1), mettre à jour leurs specs, critères et tests, ré-épingler, republier.`);
}

export function applyEvent({ id, nexus, push = false, noCommit = false, force = false }) {
  const e = loadEvent(id);
  const file = join(nexus, e.artifact);
  if (!existsSync(file)) throw new Error(`Contrat introuvable : ${e.artifact}`);
  const text = readFileSync(file, 'utf8');
  const fm = parseFrontmatter(text);
  const current = fm && fm.meta.version;
  if (!current) throw new Error('Frontmatter illisible dans le contrat.');
  if (cmpVersion(current, e.newVersion) >= 0 || text.includes(`## Changement ${e.newVersion}`)) throw new Error(`Déjà appliqué : ${e.artifact} est en ${current}.`);
  if (cmpVersion(current, e.minCurrentVersion) < 0 && !force) throw new Error(`${e.artifact} est encore en ${current} : la squad n'a pas publié sa v1. Trop tôt pour l'événement (--force pour passer outre).`);

  // Instantané pour pouvoir annuler
  mkdirSync(STATE, { recursive: true });
  const created = (e.newFiles || []).filter(f => !existsSync(join(nexus, f.to))).map(f => f.to);
  writeFileSync(join(STATE, `${id}.json`), JSON.stringify({ artifact: e.artifact, before: text, created }, null, 2));

  // 1. version et date de validation, 2. section « Changement » en fin de fichier
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  let front = m[1].replace(/^version:.*$/m, `version: ${e.newVersion}`).replace(/^last-validated:.*$/m, `last-validated: ${today()}`);
  const append = readFileSync(join(EVENTS, id, e.appendFrom), 'utf8');
  const next = `---\n${front}\n---\n${text.slice(m[0].length).replace(/\s+$/, '\n')}${append}`;
  writeFileSync(file, next);
  for (const f of e.newFiles || []) {
    const dest = join(nexus, f.to);
    mkdirSync(dirname(dest), { recursive: true });
    if (!existsSync(dest)) writeFileSync(dest, readFileSync(join(EVENTS, id, f.from), 'utf8'));
  }

  const out = [`✓ ${e.artifact} : ${current} → ${e.newVersion}`, ...created.map(c => `✓ nouveau fichier : ${c}`)];
  if (!noCommit) {
    git(nexus, ['add', e.artifact, ...(e.newFiles || []).map(f => f.to)]);
    git(nexus, ['-c', 'user.name=animation', '-c', 'user.email=animation@hackathon.local', 'commit', '-m', e.commitMessage]);
    out.push('✓ commit créé');
    if (push) {
      try { git(nexus, ['pull', '--rebase', '--autostash']); git(nexus, ['push']); out.push('✓ publié (push)'); }
      catch (err) { out.push(`✗ push impossible : ${String(err.stderr || err.message).split('\n')[0]}`); }
    }
  }
  return { event: e, from: current, to: e.newVersion, log: out };
}

export function undoEvent({ id, nexus, push = false }) {
  const e = loadEvent(id);
  const f = join(STATE, `${id}.json`);
  if (!existsSync(f)) throw new Error('Aucun instantané : rien à annuler.');
  const snap = JSON.parse(readFileSync(f, 'utf8'));
  writeFileSync(join(nexus, snap.artifact), snap.before);
  for (const c of snap.created) rmSync(join(nexus, c), { force: true });
  git(nexus, ['add', '-A', snap.artifact, ...snap.created]);
  git(nexus, ['-c', 'user.name=animation', '-c', 'user.email=animation@hackathon.local', 'commit', '-m', `animation: annule ${e.id} (répétition)`]);
  if (push) { try { git(nexus, ['pull', '--rebase', '--autostash']); git(nexus, ['push']); } catch { /* push non disponible */ } }
  rmSync(f, { force: true });
  return `✓ ${snap.artifact} restauré`;
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  const a = parseArgs(process.argv.slice(2));
  const [cmd, id] = a._;
  const nexus = resolve(a.nexus || DEFAULT_NEXUS);
  try {
    if (cmd === 'list') list();
    else if (cmd === 'card' && id) card(id);
    else if (cmd === 'apply' && id) console.log(applyEvent({ id, nexus, push: a.push, noCommit: a.noCommit, force: a.force }).log.join('\n'));
    else if (cmd === 'undo' && id) console.log(undoEvent({ id, nexus, push: a.push }));
    else console.log('Usage : node tools/event.mjs list | card <id> | apply <id> [--push] [--no-commit] [--force] | undo <id> [--push]   (option : --nexus <dossier>)');
  } catch (e) {
    console.error(`✗ ${e.message}`);
    process.exit(1);
  }
}
