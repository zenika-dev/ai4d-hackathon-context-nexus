#!/usr/bin/env node
// Pose l'expérience du hackathon dans un starter : coach (/bienvenue, /coach), style pédagogique,
// garde-fous, permissions sûres. Relançable sans risque ; échoue en silence (le starter reste utilisable sans).
//
//   node ../context-nexus/tools/overlay/apply-overlay.mjs                  # depuis le dossier du starter
//   node ../context-nexus/tools/overlay/apply-overlay.mjs --squad squad-2-prix --starter ~/hackathon/starter-squad-2-prix
//
// Les fichiers posés sont exclus de git (.git/info/exclude) : rien à committer dans le starter.

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, copyFileSync, rmSync, appendFileSync, chmodSync } from 'node:fs';
import { join, dirname, resolve, basename, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../lib/nexus.mjs';

const OVERLAY = join(dirname(fileURLToPath(import.meta.url)), 'claude');

function parseArgs(argv) {
  const a = { prune: true };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--starter') a.starter = argv[++i];
    else if (k === '--squad') a.squad = argv[++i];
    else if (k === '--no-prune') a.prune = false;
    else if (k === '--dry-run') a.dry = true;
    else if (k === '--help' || k === '-h') a.help = true;
  }
  return a;
}

const union = (a = [], b = []) => [...new Set([...a, ...b])];

function mergeSettings(existing, overlay) {
  const out = { ...existing };
  for (const [k, v] of Object.entries(overlay)) {
    if (k === 'permissions') {
      const e = existing.permissions || {};
      out.permissions = { ...e, ...v, allow: union(e.allow, v.allow), deny: union(e.deny, v.deny), additionalDirectories: union(e.additionalDirectories, v.additionalDirectories) };
    } else if (k === 'hooks') {
      out.hooks = { ...(existing.hooks || {}) };
      for (const [event, entries] of Object.entries(v)) {
        const have = new Set((out.hooks[event] || []).map(x => JSON.stringify(x)));
        out.hooks[event] = [...(out.hooks[event] || []), ...entries.filter(x => !have.has(JSON.stringify(x)))];
      }
    } else if (!(k in existing)) {
      out[k] = v;
    }
  }
  return out;
}

function copyTree(src, dst, skip, log) {
  mkdirSync(dst, { recursive: true });
  for (const name of readdirSync(src)) {
    const s = join(src, name);
    const d = join(dst, name);
    if (skip(s)) continue;
    if (statSync(s).isDirectory()) copyTree(s, d, skip, log);
    else { copyFileSync(s, d); if (name.endsWith('.mjs')) chmodSync(d, 0o755); log.push(relative(dirname(dirname(dst)), d)); }
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { console.log('Usage : node apply-overlay.mjs [--starter <dossier>] [--squad <squad>] [--no-prune] [--dry-run]'); return; }
  const starter = resolve(args.starter || process.cwd());
  const config = loadConfig();
  const guess = basename(starter).replace(/^starter-/, '');
  const squad = args.squad || process.env.SQUAD || (config.squads[guess] ? guess : null);
  if (!existsSync(starter)) { console.log(`Overlay : dossier introuvable (${starter})`); return; }
  if (!squad || !config.squads[squad]) { console.log('Overlay : squad non détectée. Ajoutez --squad squad-1-offre (ou squad-2-prix, squad-3-paiement, squad-4-experience).'); return; }
  if (args.dry) { console.log(`Overlay (essai à blanc) : ${squad} dans ${starter}`); return; }

  const done = [];
  // 1. settings.json fusionné, puis le reste de l'overlay
  const settingsPath = join(starter, '.claude', 'settings.json');
  let existing = {};
  try { existing = existsSync(settingsPath) ? JSON.parse(readFileSync(settingsPath, 'utf8')) : {}; } catch { existing = {}; }
  const overlaySettings = JSON.parse(readFileSync(join(OVERLAY, 'settings.json'), 'utf8'));
  mkdirSync(dirname(settingsPath), { recursive: true });
  writeFileSync(settingsPath, JSON.stringify(mergeSettings(existing, overlaySettings), null, 2) + '\n');
  done.push('.claude/settings.json');
  const log = [];
  copyTree(OVERLAY, join(starter, '.claude'), p => p === join(OVERLAY, 'settings.json'), log);

  // 2. squad mémorisée (lue par les hooks, le coach et la barre d'état)
  mkdirSync(join(starter, '.hackathon'), { recursive: true });
  writeFileSync(join(starter, '.hackathon', 'squad'), squad + '\n');

  // 3. exclusion de git : le starter reste propre
  const gitDir = join(starter, '.git');
  if (existsSync(gitDir) && statSync(gitDir).isDirectory()) {
    const excl = join(gitDir, 'info', 'exclude');
    mkdirSync(dirname(excl), { recursive: true });
    const have = existsSync(excl) ? readFileSync(excl, 'utf8') : '';
    const lines = ['/.hackathon/', '/.claude/settings.json', '/.claude/statusline.mjs', '/.claude/hooks/', '/.claude/output-styles/coach-pdlc.md', '/.claude/skills/bienvenue/', '/.claude/skills/coach/']
      .filter(l => !have.split('\n').includes(l));
    if (lines.length) appendFileSync(excl, (have && !have.endsWith('\n') ? '\n' : '') + lines.join('\n') + '\n');
  }

  // 4. commande Spec Kit dépréciée qui crée des tickets GitHub : retirée
  let pruned = false;
  const tti = join(starter, '.claude', 'skills', 'speckit-taskstoissues');
  if (args.prune && existsSync(tti)) { rmSync(tti, { recursive: true, force: true }); pruned = true; }

  console.log(`✓ Expérience du hackathon posée pour ${squad} : /bienvenue, /coach, style « coach-pdlc », garde-fous et permissions sûres.`);
  if (pruned) console.log('  /speckit-taskstoissues retiré (déprécié, créerait des tickets GitHub).');
  console.log('  Relancez claude, puis tapez /bienvenue.');
}

try { main(); } catch (e) { console.log(`Overlay : non posé (${e.message}). Le starter reste utilisable sans.`); }
