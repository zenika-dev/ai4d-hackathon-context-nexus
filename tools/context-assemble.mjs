#!/usr/bin/env node
// context-assemble · simule le Context Assembler du Context Nexus pour le dry run du 26/10.
// Sans dépendance (Node 20+). Utilisé par les starters (npm run context, gate-check) et les devcontainers.
//
//   node tools/context-assemble.mjs --squad squad-1-offre                 # brief + dépendances
//   node tools/context-assemble.mjs --squad squad-1-offre --out ../starter/.context/brief.md
//   node tools/context-assemble.mjs --squad squad-1-offre --mark-stale    # passe ses artefacts périmés en "stale"
//   node tools/context-assemble.mjs --squad squad-1-offre --check         # code retour 1 si stale (gate-check)
//   node tools/context-assemble.mjs --all --mark-stale                    # réservé à l'animation

import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from 'node:fs';
import { join, relative, dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LAYERS = ['org', 'programme', 'teams'];

function parseArgs(argv) {
  const args = { squad: null, out: null, markStale: false, check: false, all: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--squad') args.squad = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--mark-stale') args.markStale = true;
    else if (a === '--check') args.check = true;
    else if (a === '--all') args.all = true;
    else if (a === '--help' || a === '-h') args.help = true;
  }
  return args;
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

function parseFrontmatter(text) {
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

function loadNexus() {
  const artifacts = new Map();
  for (const layer of LAYERS) {
    for (const file of walk(join(ROOT, layer))) {
      const text = readFileSync(file, 'utf8');
      const fm = parseFrontmatter(text);
      if (!fm) continue;
      const path = relative(ROOT, file);
      artifacts.set(path, { path, file, text, ...fm });
    }
  }
  return artifacts;
}

const squadOf = path => (path.match(/^teams\/([^/]+)\//) || [])[1] || null;
const major = v => String(v || '0').split('.')[0];

// Compare chaque dépendance épinglée (chemin@version) avec la version courante de l'artefact visé.
function checkPins(artifact, artifacts) {
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

function setStatus(artifact, status) {
  const text = artifact.text.replace(/^(---\n[\s\S]*?)^status:\s*\S+/m, `$1status: ${status}`);
  writeFileSync(artifact.file, text);
  artifact.meta.status = status;
}

// Règles d'enforcement du Context Nexus v0.3 pour les contracts qui déclarent une exception.
function contractAdmission(a) {
  if (a.meta.register !== 'contracts' || !a.meta['exception-to']) return 'ok';
  return a.meta['exception-approved-by'] ? 'exception-autorisee' : 'exception-en-attente';
}

function assemble(squad, artifacts) {
  const own = [...artifacts.values()].filter(a => squadOf(a.path) === squad);
  if (own.length === 0) throw new Error(`Aucun artefact pour la squad "${squad}" dans teams/`);

  const systemPrompt = [...artifacts.values()].filter(a =>
    a.meta['consumption-mode'] === 'system-prompt' && (!squadOf(a.path) || squadOf(a.path) === squad));
  const rag = [...artifacts.values()].filter(a => a.meta['consumption-mode'] === 'rag' && !squadOf(a.path));
  const consumed = new Map();
  for (const a of own) for (const ref of a.meta.consumes || []) {
    const [path, pinned] = ref.split('@');
    if (squadOf(path) !== squad) consumed.set(path, pinned);
  }
  const injected = [
    ...own.filter(a => a.meta['consumption-mode'] !== 'system-prompt'),
    ...[...consumed.keys()].map(p => artifacts.get(p)).filter(Boolean)
      .filter(a => !systemPrompt.includes(a)),
  ];
  const excluded = [];
  const keep = list => list.filter(a => {
    const adm = contractAdmission(a);
    if (adm === 'exception-en-attente') { excluded.push(a); return false; }
    return true;
  });

  const brief = {
    systemPrompt: keep(systemPrompt),
    injected: keep(injected),
    rag,
    excluded,
    pins: own.map(a => ({ a, issues: checkPins(a, artifacts) })),
  };
  const fingerprint = [...brief.systemPrompt, ...brief.injected]
    .map(a => `${a.path}@${a.meta.version}`).sort().join('\n');
  brief.id = `TB-${squad}-${createHash('sha1').update(fingerprint).digest('hex').slice(0, 8)}`;
  return brief;
}

function renderBriefFile(squad, brief) {
  const section = (title, list) => list.length === 0 ? '' :
    `\n## ${title}\n\n` + list.map(a =>
      `<!-- ${a.path} · v${a.meta.version} · ${a.meta.status} -->\n${a.body.trim()}\n`).join('\n---\n\n');
  return `# Task brief ${brief.id}

> Généré par context-assemble le ${new Date().toISOString()} pour **${squad}**. Ne pas éditer à la main : régénérer.
> Les versions ci-dessous sont celles du Context Nexus au moment de l'assemblage.
${brief.pins.some(p => p.issues.length) ? '\n> ⚠️ Des dépendances ont changé depuis leur épinglage : voir la sortie de context-assemble.\n' : ''}
${section('Règles et contracts toujours applicables (system prompt)', brief.systemPrompt)}
${section('Contexte de mission (context injection)', brief.injected)}
## Connaissances à consulter à la demande (RAG simulé)

${brief.rag.map(a => `- \`${a.path}\` (v${a.meta.version})`).join('\n')}
`;
}

function printBrief(squad, brief) {
  const line = a => `    - ${a.path}@${a.meta.version}  [${a.meta.status}]`;
  console.log(`task_brief:\n  id: ${brief.id}\n  squad: ${squad}`);
  console.log(`  system_prompt:\n${brief.systemPrompt.map(line).join('\n')}`);
  console.log(`  context_injection:\n${brief.injected.map(line).join('\n')}`);
  console.log(`  rag:\n${brief.rag.map(line).join('\n')}`);
  if (brief.excluded.length)
    console.log(`  exclus (exception non approuvée):\n${brief.excluded.map(line).join('\n')}`);
}

function reportPins(pinsList) {
  let stale = 0;
  for (const { a, issues } of pinsList) {
    if (issues.length === 0) continue;
    stale++;
    console.log(`\n✗ ${a.path} (v${a.meta.version}, ${a.meta.status}) dépend de versions qui ont changé :`);
    for (const i of issues)
      console.log(`    ${i.kind.padEnd(16)} ${i.path}  épinglé ${i.pinned} → actuel ${i.current ?? '—'}`);
  }
  if (stale === 0) console.log('\n✓ Toutes les dépendances épinglées sont à jour.');
  return stale;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || (!args.squad && !args.all)) {
    console.log('Usage : node tools/context-assemble.mjs --squad <squad> [--out <fichier>] [--mark-stale] [--check]\n' +
                '        node tools/context-assemble.mjs --all [--mark-stale]');
    process.exit(args.help ? 0 : 2);
  }
  const artifacts = loadNexus();

  if (args.all) {
    const pins = [...artifacts.values()].map(a => ({ a, issues: checkPins(a, artifacts) }));
    const stale = reportPins(pins);
    if (args.markStale) for (const { a, issues } of pins)
      if (issues.length && ['active', 'draft'].includes(a.meta.status)) {
        setStatus(a, 'stale');
        console.log(`  → ${a.path} passé en stale`);
      }
    process.exit(args.check && stale ? 1 : 0);
  }

  const brief = assemble(args.squad, artifacts);
  printBrief(args.squad, brief);
  const stale = reportPins(brief.pins);

  if (args.markStale) for (const { a, issues } of brief.pins)
    if (issues.length && ['active', 'draft'].includes(a.meta.status)) {
      setStatus(a, 'stale');
      console.log(`  → ${a.path} passé en stale : relire le changement, mettre à jour l'artefact et son épinglage, puis le repasser en active.`);
    }

  const ownStale = brief.pins.filter(p => p.a.meta.status === 'stale').length;
  const out = args.out || join(ROOT, '.context', `${args.squad}.md`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, renderBriefFile(args.squad, brief));
  console.log(`\nBrief écrit dans ${relative(process.cwd(), out) || out}`);

  if (args.check && (stale || ownStale)) {
    console.log('\nCHECK : no-go, des artefacts sont stale ou épinglés sur une version périmée.');
    process.exit(1);
  }
}

main();
