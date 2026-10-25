// Bibliothèque commune des outils du hackathon : lecture du Context Nexus, épinglages, journaux.
// Sans dépendance (Node 20+). Volontairement indépendante de context-assemble.mjs, qu'elle ne modifie pas :
// les deux lisent les mêmes fichiers avec les mêmes règles d'épinglage.

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const LAYERS = ['org', 'programme', 'teams'];
export const TOOLS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const DEFAULT_NEXUS = resolve(TOOLS_DIR, '..');

export function parseFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return null;
  const meta = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([\w-]+):\s*(.*?)\s*(#.*)?$/);
    if (!kv) continue;
    let v = kv[2];
    if (v.startsWith('[') && v.endsWith(']')) v = v.slice(1, -1).split(',').map(s => s.trim()).filter(Boolean);
    else if (v === 'null' || v === '') v = null;
    meta[kv[1]] = v;
  }
  return { meta, body: text.slice(m[0].length) };
}

function walk(dir) {
  let files = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) files = files.concat(walk(p));
    else if (name.endsWith('.md') && name !== 'README.md') files.push(p);
  }
  return files;
}

export function loadNexus(root) {
  const artifacts = new Map();
  for (const layer of LAYERS) {
    const dir = join(root, layer);
    if (!existsSync(dir)) continue;
    for (const file of walk(dir)) {
      const text = readFileSync(file, 'utf8');
      const fm = parseFrontmatter(text);
      if (!fm) continue;
      const path = relative(root, file).split('\\').join('/');
      artifacts.set(path, { path, file, text, ...fm });
    }
  }
  return artifacts;
}

export const squadOf = path => (path.match(/^teams\/([^/]+)\//) || [])[1] || null;
export const major = v => String(v || '0').split('.')[0];

export function cmpVersion(a, b) {
  const pa = String(a || '0').split('.').map(Number);
  const pb = String(b || '0').split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
}

// Même règle que context-assemble : version courante différente de la version épinglée = écart.
export function checkPins(artifact, artifacts) {
  const issues = [];
  for (const ref of artifact.meta.consumes || []) {
    const [path, pinned] = ref.split('@');
    const target = artifacts.get(path);
    if (!target) { issues.push({ path, pinned, kind: 'INTROUVABLE' }); continue; }
    const current = target.meta.version;
    if (current !== pinned) {
      issues.push({ path, pinned, current, kind: major(current) !== major(pinned) ? 'RUPTURE' : 'MISE_A_JOUR' });
    } else if (['stale', 'deprecated', 'superseded'].includes(target.meta.status)) {
      issues.push({ path, pinned, current, kind: `CIBLE_${target.meta.status.toUpperCase()}` });
    }
  }
  return issues;
}

// Journaux au format table Markdown : `| 2026-10-26T14:27:00+01:00 | clé | valeur | qui | motif |`
export function parseJournal(text) {
  const rows = [];
  for (const line of String(text || '').split('\n')) {
    if (!line.trim().startsWith('|')) continue;
    const cells = line.trim().replace(/^\||\|$/g, '').split('|').map(s => s.trim());
    if (!/^\d{4}-\d{2}-\d{2}T/.test(cells[0] || '')) continue;
    rows.push(cells);
  }
  return rows;
}

export function readJournal(root, squad, name) {
  const file = join(root, 'teams', squad, 'operations', name);
  return existsSync(file) ? parseJournal(readFileSync(file, 'utf8')) : [];
}

// Dernier verdict par gate : { G1: { at, verdict, keeper, note } }
export function gateVerdicts(root, squad) {
  const out = {};
  for (const [at, gate, verdict, keeper, note] of readJournal(root, squad, 'gates-journal.md')) {
    out[gate] = { at, verdict: String(verdict).toUpperCase(), keeper, note };
  }
  return out;
}

// Fuseau du hackathon : les Codespaces sont en UTC, l'événement est à l'heure de Paris. Toutes les heures
// (agenda, créneaux de gate, horodatage des verdicts) sont lues dans ce fuseau, jamais dans celui de la machine.
export const DEFAULT_TZ = 'Europe/Paris';

export function zonedParts(date = new Date(), tz = DEFAULT_TZ) {
  const o = {};
  for (const p of new Intl.DateTimeFormat('en-GB', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(date)) o[p.type] = p.value;
  return { y: +o.year, mo: +o.month, d: +o.day, h: +o.hour, mi: +o.minute, s: +o.second };
}

// Heure murale (jour AAAA-MM-JJ + HH:MM) dans le fuseau → millisecondes depuis 1970
export function zonedMs(day, hhmm, tz = DEFAULT_TZ) {
  const [y, mo, d] = day.split('-').map(Number);
  const [h, mi] = hhmm.split(':').map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const p = zonedParts(new Date(guess), tz);
  return guess - (Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) - guess);
}

export function minutesOfDay(date = new Date(), tz = DEFAULT_TZ) { const p = zonedParts(date, tz); return p.h * 60 + p.mi; }

export function isoNow(date = new Date(), tz = DEFAULT_TZ) {
  const pad = n => String(n).padStart(2, '0');
  const p = zonedParts(date, tz);
  const off = Math.round((Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) - Math.floor(date.getTime() / 1000) * 1000) / 60000);
  const sign = off >= 0 ? '+' : '-';
  const a = Math.abs(off);
  return `${p.y}-${pad(p.mo)}-${pad(p.d)}T${pad(p.h)}:${pad(p.mi)}:${pad(p.s)}${sign}${pad(Math.floor(a / 60))}:${pad(a % 60)}`;
}

export function loadConfig(path = join(TOOLS_DIR, 'hackathon.config.json')) {
  const c = JSON.parse(readFileSync(path, 'utf8'));
  if (!c.timezone) c.timezone = DEFAULT_TZ;
  return c;
}
