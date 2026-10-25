#!/usr/bin/env node
// simuler · jouer les autres squads pendant une répétition en solo. À lancer sur un clone À PART du Nexus de répétition
// (jamais sur le Nexus partagé du jour J) : chaque action crée un commit « Squad N (simulé) » et le publie.
//
//   node tools/repetition/simuler.mjs m2 --pour squad-2-prix           # Expérience publie evenements-achat v1 (jalon M2)
//   node tools/repetition/simuler.mjs v1 --pour squad-2-prix           # les autres squads publient tous leurs contrats en v1
//   node tools/repetition/simuler.mjs gate G1 --pour squad-2-prix      # GO des autres squads à une gate (écran commun vivant)
//   node tools/repetition/simuler.mjs realigner --pour squad-2-prix    # après l'événement : les autres squads ré-épinglent et republient
//   node tools/repetition/simuler.mjs etat                             # versions et épinglages de tous les contrats
//   node tools/repetition/simuler.mjs auto --pour squad-2-prix         # pilote automatique : les autres squads suivent votre rythme
//
// --pour <squad> : la squad que vous jouez ; elle n'est jamais touchée. --nexus <dossier> : le clone (par défaut, ce dépôt).
// --no-push : commits locaux seulement.

import { existsSync, readFileSync, writeFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { DEFAULT_NEXUS, loadConfig, parseFrontmatter, isoNow, gateVerdicts } from '../lib/nexus.mjs';

const CONTRACTS = {
  'squad-1-offre': ['offre-api'],
  'squad-2-prix': ['regle-prix', 'kpi'],
  'squad-3-paiement': ['paiement-api', 'contraintes-pci'],
  'squad-4-experience': ['evenements-achat', 'ecrans'],
};

function parseArgs(argv) {
  const a = { _: [], push: true };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--pour') a.pour = argv[++i];
    else if (k === '--nexus') a.nexus = argv[++i];
    else if (k === '--no-push') a.push = false;
    else if (k === '--toutes') a.toutes = Number(argv[++i]);
    else if (k === '--delai') a.delai = Number(argv[++i]);
    else if (k === '--help' || k === '-h') a.help = true;
    else a._.push(k);
  }
  return a;
}

const args = parseArgs(process.argv.slice(2));
const nexus = resolve(args.nexus || DEFAULT_NEXUS);
const config = loadConfig();
const today = new Intl.DateTimeFormat('en-CA', { timeZone: config.timezone || 'Europe/Paris' }).format(new Date());
const git = (...a) => execFileSync('git', ['-C', nexus, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

const rel = (squad, name) => `teams/${squad}/contracts/${name}.md`;
const read = p => readFileSync(join(nexus, p), 'utf8');
const versionOf = p => (existsSync(join(nexus, p)) ? parseFrontmatter(read(p))?.meta.version : null);
const others = () => Object.keys(CONTRACTS).filter(s => s !== args.pour);
const num = squad => config.squads[squad].number;

function pull() { try { git('pull', '--rebase', '--autostash', '-q'); } catch { /* hors ligne : on continue en local */ } }

function publish(squad, files, message, author = `Squad ${num(squad)} (simulé)`) {
  git('add', '--', ...files);
  git('-c', `user.name=${author}`, '-c', 'user.email=simulation@hackathon.local', 'commit', '-q', '-m', `${squad}: ${message}`, '--', ...files);
  if (!args.push) return;
  for (let i = 0; i < 6; i++) {
    try { git('pull', '--rebase', '--autostash', '-q'); git('push', '-q'); return; } catch { /* quelqu'un a publié en même temps : on recommence */ }
  }
  console.log(`  ⚠ ${squad} : publication refusée, le commit reste local (git -C ${nexus} push)`);
}

// Ré-épingle chaque dépendance sur sa version actuelle ; renvoie le texte et la liste des changements.
function repin(text) {
  const notes = [];
  const out = text.replace(/((?:teams|programme|org)\/[\w./-]+\.md)@(\d+\.\d+\.\d+)/g, (m, dep, old) => {
    const cur = versionOf(dep) || old;
    if (cur !== old) notes.push(`${dep.split('/').pop().replace('.md', '')} ${old} → ${cur}`);
    return `${dep}@${cur}`;
  });
  return { text: out, notes };
}

function setVersion(text, v) {
  return text.replace(/^version:\s*\S+/m, `version: ${v}`).replace(/^last-validated:\s*\S+/m, `last-validated: ${today}`);
}

function publishV1(squad, names) {
  const files = [];
  for (const name of names) {
    const p = rel(squad, name);
    const v = versionOf(p);
    if (!v || Number(v.split('.')[0]) >= 1) continue;
    const { text } = repin(read(p));
    writeFileSync(join(nexus, p), setVersion(text, '1.0.0').replace(/^status:\s*\S+/m, 'status: active').trimEnd()
      + `\n\n## Changement 1.0.0\n\nPubliée en v1 par la squad ${num(squad)} (simulation de répétition) : contrat figé, épinglages à jour.\n`);
    files.push(p);
  }
  if (!files.length) return false;
  publish(squad, files, `publie ${files.map(f => f.split('/').pop().replace('.md', '')).join(', ')} v1.0.0`);
  console.log(`✓ ${config.squads[squad].label} publie ${files.map(f => f.split('/').pop().replace('.md', '')).join(', ')} en 1.0.0`);
  return true;
}

function realignOnce() {
  let changed = 0;
  for (const squad of others()) {
    const files = [], notes = [];
    for (const name of CONTRACTS[squad]) {
      const p = rel(squad, name);
      if (!existsSync(join(nexus, p))) continue;
      const r = repin(read(p));
      if (!r.notes.length) continue;
      const [maj, min] = (versionOf(p) || '1.0.0').split('.').map(Number);
      const v = `${maj}.${min + 1}.0`;
      writeFileSync(join(nexus, p), setVersion(r.text, v).replace(/^status:\s*stale/m, 'status: active').trimEnd()
        + `\n\n## Réalignement ${v}\n\nContrat relu et réaligné par la squad ${num(squad)} (simulation de répétition) : ${r.notes.join(', ')}.\n`);
      files.push(p); notes.push(...r.notes);
    }
    if (!files.length) continue;
    const uniq = [...new Set(notes)];
    publish(squad, files, `réaligne ${files.map(f => f.split('/').pop().replace('.md', '')).join(', ')} (${uniq.join(', ')})`);
    console.log(`✓ ${config.squads[squad].label} réaligne : ${uniq.join(', ')}`);
    changed++;
  }
  return changed;
}

function gate(g) {
  if (!config.gates[g]) throw new Error(`Gate inconnue : ${g} (G1 à G4)`);
  for (const squad of others()) {
    if (gateVerdicts(nexus, squad)[g]?.verdict === 'GO') continue;
    const p = `teams/${squad}/operations/gates-journal.md`;
    const file = join(nexus, p);
    mkdirSync(join(nexus, 'teams', squad, 'operations'), { recursive: true });
    if (!existsSync(file)) writeFileSync(file, `# Journal des gates · ${squad}\n\nUne ligne par verdict : date, gate, verdict, gate keeper, motif. Trace de la décision humaine à chaque gate.\n\n| Date | Gate | Verdict | Gate keeper | Motif |\n|---|---|---|---|---|\n`);
    appendFileSync(file, `| ${isoNow()} | ${g} | GO | simulation | répétition en solo |\n`);
    publish(squad, [p], `${g} GO (simulation)`, 'gate-keeper (simulé)');
    console.log(`✓ ${config.squads[squad].label} : ${g} GO`);
  }
}

function etat() {
  for (const squad of Object.keys(CONTRACTS)) {
    for (const name of CONTRACTS[squad]) {
      const p = rel(squad, name);
      const fm = parseFrontmatter(read(p));
      const pins = (read(p).match(/(?:teams|programme|org)\/[\w./-]+\.md@\d+\.\d+\.\d+/g) || [])
        .map(x => { const [dep, v] = x.split('@'); const cur = versionOf(dep); return `${dep.split('/').pop().replace('.md', '')}@${v}${cur && cur !== v ? ` (actuel ${cur})` : ''}`; });
      console.log(`${(config.squads[squad].label + ' · ' + name).padEnd(30)} ${String(fm.meta.version).padEnd(7)} ${fm.meta.status.padEnd(7)} ${pins.join(', ')}`);
    }
  }
}

// ---------- pilote automatique ----------
// Les autres squads suivent le rythme de la vôtre, sans aucune commande : elles passent leurs gates quand vous passez
// les vôtres, publient M2 puis leurs v1 après votre M1, et se réalignent un peu après chaque changement de contrat
// (le délai laisse le temps de voir le rouge et l'ambre sur l'écran commun).

const majorOf = p => Number(String(versionOf(p) || '0').split('.')[0]);
const hhmm = () => new Intl.DateTimeFormat('fr-FR', { timeZone: config.timezone || 'Europe/Paris', hour: '2-digit', minute: '2-digit' }).format(new Date());

function lastHumanCommit() {
  for (const line of git('log', '-30', '--format=%ct|%an').trim().split('\n')) {
    const [t, author] = line.split('|');
    if (!/simulé/.test(author)) return Number(t) * 1000;
  }
  return 0;
}

function autoTick() {
  pull();
  const me = args.pour;
  const mine = gateVerdicts(nexus, me);
  // 1. Gates : les autres squads ne prennent jamais d'avance sur vous.
  for (const g of ['G1', 'G2', 'G3', 'G4'])
    if (mine[g]?.verdict === 'GO' && others().some(s => gateVerdicts(nexus, s)[g]?.verdict !== 'GO')) return gate(g);
  // 2. Jalons et contrats v1, une squad à la fois.
  const prix = rel('squad-2-prix', 'regle-prix'), m1 = majorOf(prix) >= 1;
  if (!m1 && me !== 'squad-2-prix' && mine.G1?.verdict === 'GO') return publishV1('squad-2-prix', ['regle-prix']);
  if (!m1) return;
  if (me !== 'squad-4-experience' && majorOf(rel('squad-4-experience', 'evenements-achat')) < 1) return publishV1('squad-4-experience', ['evenements-achat']);
  for (const squad of ['squad-2-prix', 'squad-1-offre', 'squad-3-paiement', 'squad-4-experience'])
    if (squad !== me && publishV1(squad, CONTRACTS[squad])) return;
  // 3. Réalignement, un tour à la fois : la vague se voit sur l'écran.
  const wait = (args.delai ?? 90) * 1000 - (Date.now() - lastHumanCommit());
  if (wait > 0) return;
  realignOnce();
}

function main() {
  const [cmd, opt] = args._;
  if (args.help || !cmd) {
    console.log('Usage : node tools/repetition/simuler.mjs <auto | m2 | v1 | gate G1 | realigner | etat> --pour <votre-squad> [--nexus <clone>] [--no-push] [--toutes 20] [--delai 90]');
    return;
  }
  if (!existsSync(join(nexus, 'teams'))) throw new Error(`Pas de Context Nexus dans ${nexus}`);
  if (cmd !== 'etat' && !config.squads[args.pour]) throw new Error('Indiquez la squad que vous jouez : --pour squad-2-prix');
  pull();
  if (cmd === 'auto') {
    const every = (args.toutes || 20) * 1000;
    console.log(`Pilote automatique des autres squads (vous jouez ${config.squads[args.pour].label}) · ${nexus}\nCtrl + C pour arrêter.`);
    const tick = () => {
      const log = console.log;
      console.log = (...m) => log(`[${hhmm()}]`, ...m);
      try { autoTick(); } catch (e) { console.log(`⚠ ${String(e.message).split('\n')[0]}`); }
      console.log = log;
      setTimeout(tick, every);
    };
    return tick();
  }
  if (cmd === 'm2') {
    if (args.pour === 'squad-4-experience') return console.log('Vous jouez Expérience : M2 est à vous.');
    if (!publishV1('squad-4-experience', ['evenements-achat'])) console.log('evenements-achat est déjà en v1.');
  } else if (cmd === 'v1') {
    // Ordre de la chaîne : Prix, Offre, Paiement, Expérience (chacun épingle la version actuelle de ce qu'il lit).
    let n = 0;
    for (const squad of ['squad-2-prix', 'squad-1-offre', 'squad-3-paiement', 'squad-4-experience'])
      if (squad !== args.pour && publishV1(squad, CONTRACTS[squad])) n++;
    if (!n) console.log('Les autres squads sont déjà en v1.');
    // Avant leur G2, les autres squads épinglent la version actuelle de ce qu'elles lisent.
    for (let r = 0; r < 5 && realignOnce(); r++) { /* jusqu'à stabilité */ }
  } else if (cmd === 'realigner') {
    // La vague : quand Offre republie, ceux qui lisent Offre doivent à leur tour se réaligner.
    let rounds = 0;
    while (realignOnce() && ++rounds < 5) { /* jusqu'à stabilité */ }
    if (!rounds) console.log('Rien à réaligner : les autres squads sont à jour.');
    console.log('Votre squad n\'est pas touchée : à vous de relire, réaligner et republier.');
  } else if (cmd === 'gate') gate(String(opt || '').toUpperCase());
  else if (cmd === 'etat') etat();
  else throw new Error(`Commande inconnue : ${cmd}`);
}

try { main(); } catch (e) { console.error(`✗ ${e.message}`); process.exit(1); }
