#!/usr/bin/env node
// nexus-board · l'écran commun du hackathon : chrono, gates des quatre squads, graphe des contrats du Context Nexus
// qui réagit quand un contrat change, jalons communs et flux des publications.
// Il ne lit que le dépôt Context Nexus (Git) : aucun accès aux postes des squads, aucune base de données.
//
//   node tools/nexus-board.mjs --pull 10                  # écran de la salle : http://localhost:4000
//   node tools/nexus-board.mjs --pull 10 --keeper --push  # poste des gate keepers : verdicts de gate et événement scripté
//
// Options : --reset (efface l'historique des changements de contrat vu par l'écran) · --port 4000 · --host 127.0.0.1 (0.0.0.0 pour l'ouvrir aux autres postes, lecture seule) · --nexus <dossier>
//           --pull <secondes> (git pull régulier) · --keeper (active les écritures, depuis ce poste uniquement) · --push
//           --reset (efface l'historique des changements de contrat gardé par l'écran : à utiliser après une répétition)
//           --squad <squad> --starter <dossier> --local <clone> : écran d'une squad (panneau « Votre squad », lu dans son starter et son clone local)

import http from 'node:http';
import { readFileSync, existsSync, writeFileSync, appendFileSync, mkdirSync, realpathSync } from 'node:fs';
import { join, resolve, basename, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { TOOLS_DIR, DEFAULT_NEXUS, DEFAULT_TZ, zonedParts, zonedMs, minutesOfDay, loadConfig, loadNexus, squadOf, checkPins, cmpVersion, major, readJournal, isoNow } from './lib/nexus.mjs';
import { computeStatus, blockAt, agendaFor } from './lib/status.mjs';
import { applyEvent } from './event.mjs';

function parseArgs(argv) {
  const a = { port: 4000, host: '127.0.0.1', pull: 0 };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--port') a.port = Number(argv[++i]);
    else if (k === '--host') a.host = argv[++i];
    else if (k === '--nexus') a.nexus = argv[++i];
    else if (k === '--pull') a.pull = Number(argv[++i]);
    else if (k === '--keeper') a.keeper = true;
    else if (k === '--reset') a.reset = true;
    else if (k === '--push') a.push = true;
    else if (k === '--squad') a.squad = argv[++i];
    else if (k === '--starter') a.starter = argv[++i];
    else if (k === '--local') a.local = argv[++i];
    else if (k === '--help' || k === '-h') a.help = true;
  }
  return a;
}

const git = (nexus, args, opts = {}) => execFileSync('git', ['-C', nexus, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 20000, ...opts });
const safe = (fn, fallback) => { try { return fn(); } catch { return fallback; } };
const hm = s => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };

// ---------- suivi des incidents (un contrat v1+ change, ses consommateurs doivent se réaligner) ----------

class Tracker {
  constructor(file) {
    this.file = file;
    // L'état (versions vues, incidents) est gardé entre deux lancements de l'écran, mais seulement le jour même :
    // une répétition de la veille ne doit pas polluer la session du lendemain. --reset l'efface à la demande.
    const today = new Date().toISOString().slice(0, 10);
    const saved = safe(() => JSON.parse(readFileSync(file, 'utf8')), {});
    const fresh = saved.day !== today;
    this.day = today;
    this.versions = fresh ? null : (saved.versions || null);
    this.incidents = fresh ? [] : (saved.incidents || []);
  }
  save() { safe(() => writeFileSync(this.file, JSON.stringify({ day: this.day, versions: this.versions, incidents: this.incidents }, null, 2))); }

  observe(nexus, artifacts, contracts, nowIso) {
    const consumersOf = p => [...artifacts.values()].filter(a => (a.meta.consumes || []).some(r => r.split('@')[0] === p));
    const first = this.versions === null;
    if (first) this.versions = {};
    for (const c of contracts) {
      const prev = this.versions[c.path];
      const cur = c.meta.version;
      // Seule une MONTÉE de version d'un contrat déjà en v1 ou plus est un changement : un retour en arrière vu un instant
      // (git pull en cours, fichier remis à l'état commité) n'ouvre jamais d'incident et ne baisse pas la version retenue.
      if (prev && cmpVersion(cur, prev) > 0 && cmpVersion(prev, '1.0.0') >= 0) this.open(c, prev, cur, nowIso);
      if (first) {
        // Au démarrage de l'écran : rattraper les écarts déjà présents (pin ≥ 1.0.0 différent de la version courante)
        for (const a of consumersOf(c.path)) {
          const pinned = (a.meta.consumes.find(r => r.split('@')[0] === c.path) || '').split('@')[1];
          if (pinned && cmpVersion(pinned, '1.0.0') >= 0 && pinned !== cur) {
            const at = safe(() => git(nexus, ['log', '-1', '--format=%cI', '--', c.path]).trim(), nowIso) || nowIso;
            this.open(c, pinned, cur, at);
          }
        }
      }
      this.versions[c.path] = prev && cmpVersion(prev, cur) > 0 ? prev : cur;
    }
    for (const inc of this.incidents) {
      const consumers = consumersOf(inc.path);
      const target = artifacts.get(inc.path);
      inc.total = consumers.length;
      inc.pending = consumers.filter(a => {
        const pinned = (a.meta.consumes.find(r => r.split('@')[0] === inc.path) || '').split('@')[1];
        return pinned !== (target && target.meta.version);
      }).map(a => a.path);
      if (!inc.resolvedAt && inc.pending.length === 0) inc.resolvedAt = nowIso;
      if (inc.resolvedAt && inc.pending.length > 0) inc.resolvedAt = null; // un nouveau changement rouvre l'incident
    }
    this.save();
  }

  open(contract, from, to, at) {
    const existing = this.incidents.find(i => i.path === contract.path && !i.resolvedAt);
    if (existing) { existing.to = to; return; }
    this.incidents.push({ path: contract.path, label: basename(contract.path, '.md'), from, to, startAt: at, resolvedAt: null, total: 0, pending: [] });
  }
}

// ---------- état de l'écran ----------

function buildState(ctx) {
  const { nexus, config, tracker } = ctx;
  const nowDate = new Date();
  const nowIso = nowDate.toISOString();
  const tz = config.timezone || DEFAULT_TZ;
  const nowMin = minutesOfDay(nowDate, tz);
  const artifacts = loadNexus(nexus);

  // Squads
  const squads = Object.entries(config.squads).map(([id, cfg]) => {
    const st = computeStatus({ nexus, squad: id, config, now: nowDate });
    const own = [...artifacts.values()].filter(a => squadOf(a.path) === id);
    const gates = {};
    for (const g of Object.keys(config.gates)) {
      const slotMin = hm(cfg.slots[g]);
      const v = st.gates[g].verdict;
      let state = 'todo';
      if (v) state = v.verdict === 'GO' ? 'go' : 'nogo';
      else if (nowMin >= slotMin) state = 'due';
      else if (nowMin >= slotMin - 10) state = 'soon';
      gates[g] = { slot: cfg.slots[g], state, verdict: v, name: config.gates[g].name, keeper: config.gates[g].keeper, auto: st.gates[g].auto, human: st.gates[g].human };
    }
    const next = st.nextGate;
    return {
      id, label: cfg.label, number: cfg.number, volet: cfg.volet, block: st.block, phase: st.phase, nextGate: next,
      nextSlotSec: next ? Math.round((hm(cfg.slots[next]) - nowMin) * 60 - zonedParts(nowDate, tz).s) : null,
      gates,
      counts: { total: own.length, active: own.filter(a => a.meta.status === 'active').length, stale: own.filter(a => a.meta.status === 'stale' || checkPins(a, artifacts).length > 0).length },
      pinIssues: st.pinIssues.map(n => ({ path: n.path, pinned: n.pinned, current: n.current, kind: n.kind })),
      lastActivity: safe(() => git(nexus, ['log', '-1', '--format=%cI', '--', `teams/${id}`]).trim(), '') || null,
    };
  });

  // Graphe des contrats
  const contracts = [...artifacts.values()].filter(a => a.meta.register === 'contracts' && squadOf(a.path));
  tracker.observe(nexus, artifacts, contracts, nowIso);
  const byPath = new Map(contracts.map(c => [c.path, c]));
  const edges = [];
  const nodes = contracts.map(c => {
    const issues = checkPins(c, artifacts);
    for (const ref of c.meta.consumes || []) {
      const [p] = ref.split('@');
      if (byPath.has(p)) edges.push({ from: p, to: c.path });
    }
    return { id: c.path, label: basename(c.path, '.md'), squad: squadOf(c.path), squadLabel: (config.squads[squadOf(c.path)] || {}).label || squadOf(c.path), version: c.meta.version, status: c.meta.status, issues: issues.map(i => ({ path: i.path, pinned: i.pinned, current: i.current, kind: i.kind })), depth: 0 };
  });
  const depthOf = (id, seen = new Set()) => {
    if (seen.has(id)) return 0;
    seen.add(id);
    const deps = edges.filter(e => e.to === id).map(e => e.from);
    return deps.length ? 1 + Math.max(...deps.map(d => depthOf(d, new Set(seen)))) : 0;
  };
  for (const n of nodes) n.depth = depthOf(n.id);
  const openIncidents = tracker.incidents.filter(i => !i.resolvedAt).map(i => i.path);
  for (const n of nodes) {
    n.incident = openIncidents.includes(n.id);
    n.stale = n.status === 'stale' || n.issues.some(i => i.kind !== 'INTROUVABLE' && cmpVersion(i.pinned, '1.0.0') >= 0) ;
    n.expected = !n.stale && n.issues.length > 0;
  }

  // Jalons communs
  const milestones = (config.milestones || []).map(m => {
    const a = artifacts.get(m.artifact);
    const done = !!a && cmpVersion(a.meta.version, m.minVersion) >= 0 && a.meta.status === 'active';
    return { ...m, current: a ? a.meta.version : null, done, late: !done && nowMin >= hm(m.due) };
  });

  // Flux des publications
  const feed = safe(() => git(nexus, ['log', '-n', '30', '--format=%cI%x1f%an%x1f%s', '--', 'teams', 'programme', 'org']).trim().split('\n').filter(Boolean).map(l => {
    const [at, who, msg] = l.split('\x1f');
    return { at, who, msg, squad: (msg.match(/^(squad-\d-[a-z]+)/) || [])[1] || null };
  }), []);

  // Écran d'une squad : son état vu depuis son starter et son clone (ce que dit /coach), mis en cache 10 s.
  let me = null;
  if (ctx.squad && config.squads[ctx.squad]) {
    if (!ctx.meCache || Date.now() - ctx.meCache.at > 10000) {
      const m = safe(() => computeStatus({ nexus: ctx.local || nexus, starter: ctx.starter || null, squad: ctx.squad, config, now: nowDate }), null);
      ctx.meCache = { at: Date.now(), me: m && {
        id: ctx.squad, label: m.label, number: m.number, volet: m.volet, phase: m.phase, nextGate: m.nextGate,
        gate: m.nextGate ? { id: m.nextGate, name: m.gates[m.nextGate].name, slot: m.gates[m.nextGate].slot, keeper: m.gates[m.nextGate].keeper, auto: m.gates[m.nextGate].auto, human: m.gates[m.nextGate].human } : null,
        step: { label: m.step.label, hat: m.step.hat, say: m.step.say, humanDo: m.step.humanDo, why: m.step.why, human: m.step.human, learn: m.step.learn, cue: m.step.cue, hatDoes: m.step.hatDoes },
        pinIssues: m.pinIssues.map(n => ({ path: n.path, pinned: n.pinned, current: n.current })), unpublished: m.unpublished,
      } };
    }
    me = ctx.meCache.me;
  }

  const day = config.date;
  const start = zonedMs(day, config.start, tz);
  const end = zonedMs(day, config.end, tz);
  return {
    now: nowIso, serverMs: Date.now(), start, end, keeper: !!ctx.keeper,
    block: blockAt(agendaFor(config, 'squad-1-offre'), nowDate, tz), tz,
    squads, graph: { nodes, edges }, incidents: tracker.incidents, milestones, feed,
    events: ctx.keeper ? safe(() => {
      const e = JSON.parse(readFileSync(join(TOOLS_DIR, 'events', '01-regle-prix-v2', 'event.json'), 'utf8'));
      const a = artifacts.get(e.artifact);
      return [{ id: '01-regle-prix-v2', ...e, applied: !!a && cmpVersion(a.meta.version, e.newVersion) >= 0 }];
    }, []) : [],
    gateNames: config.gates, me,
  };
}

// ---------- écriture des verdicts de gate ----------

function writeVerdict(ctx, { squad, gate, verdict, keeper, note }) {
  const { nexus, config } = ctx;
  if (!config.squads[squad]) throw new Error('Squad inconnue');
  if (!config.gates[gate]) throw new Error('Gate inconnue');
  if (!['GO', 'NO-GO'].includes(verdict)) throw new Error('Verdict invalide');
  const who = String(keeper || '').replace(/[|\n\r]/g, ' ').trim().slice(0, 60);
  if (!who) throw new Error('Nom du gate keeper requis');
  const clean = String(note || '').replace(/[|\n\r]/g, ' ').trim().slice(0, 200);
  const dir = join(nexus, 'teams', squad, 'operations');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, 'gates-journal.md');
  if (!existsSync(file)) writeFileSync(file, `# Journal des gates · ${squad}\n\nUne ligne par verdict : date, gate, verdict, gate keeper, motif. Trace de la décision humaine à chaque gate.\n\n| Date | Gate | Verdict | Gate keeper | Motif |\n|---|---|---|---|---|\n`);
  appendFileSync(file, `| ${isoNow()} | ${gate} | ${verdict} | ${who} | ${clean} |\n`);
  const log = [`${gate} ${verdict} enregistré pour ${squad}`];
  try {
    const rel = `teams/${squad}/operations/gates-journal.md`;
    git(nexus, ['add', rel]);
    git(nexus, ['-c', 'user.name=gate-keeper', '-c', 'user.email=gatekeeper@hackathon.local', 'commit', '-m', `${squad}: ${gate} ${verdict} (${who})`]);
    if (ctx.push) { git(nexus, ['pull', '--rebase', '--autostash']); git(nexus, ['push']); log.push('publié'); }
  } catch (e) { log.push(`git : ${String(e.stderr || e.message).split('\n')[0]}`); }
  return log.join(' · ');
}

// ---------- serveur ----------

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { console.log('Usage : node tools/nexus-board.mjs [--port 4000] [--host 127.0.0.1] [--nexus <dossier>] [--pull <secondes>] [--keeper] [--push]'); return; }
  const nexus = resolve(args.nexus || DEFAULT_NEXUS);
  const config = loadConfig();
  const stateFile = join(tmpdir(), `nexus-board-${Buffer.from(nexus).toString('hex').slice(-16)}.json`);
  if (args.reset) safe(() => writeFileSync(stateFile, '{}'));
  const tracker = new Tracker(stateFile);
  const ctx = { nexus, config, tracker, keeper: args.keeper, push: args.push, squad: args.squad, starter: args.starter ? resolve(args.starter) : null, local: args.local ? resolve(args.local) : null };
  const html = () => readFileSync(join(TOOLS_DIR, 'board', 'index.html'), 'utf8');

  let pulling = false;
  if (args.pull > 0) {
    const pull = () => {
      if (pulling) return;
      pulling = true;
      try { git(nexus, ['pull', '--rebase', '--autostash', '--quiet']); } catch { /* hors ligne ou rien à tirer : on continue */ }
      pulling = false;
    };
    pull();
    setInterval(pull, args.pull * 1000);
  }

  const loopback = req => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
  const json = (res, code, body) => { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(JSON.stringify(body)); };
  const readBody = req => new Promise((ok, ko) => { let d = ''; req.on('data', c => { d += c; if (d.length > 20000) { req.destroy(); ko(new Error('trop gros')); } }); req.on('end', () => { try { ok(JSON.parse(d || '{}')); } catch (e) { ko(e); } }); });

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://x');
      if (req.method === 'GET' && url.pathname === '/') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }); return res.end(html()); }
      if (req.method === 'GET' && url.pathname === '/api/state') return json(res, 200, buildState(ctx));
      if (req.method === 'GET' && url.pathname === '/health') return json(res, 200, { ok: true });
      if (req.method === 'POST' && (url.pathname === '/api/gate' || url.pathname === '/api/event')) {
        if (!ctx.keeper || !loopback(req) || req.headers['x-board'] !== '1') return json(res, 403, { error: 'Réservé au poste des gate keepers (option --keeper, depuis cette machine).' });
        const body = await readBody(req);
        if (url.pathname === '/api/gate') return json(res, 200, { ok: true, message: writeVerdict(ctx, body) });
        const id = String(body.id || '');
        if (!/^[\w-]+$/.test(id)) throw new Error('Identifiant d\'événement invalide');
        const r = applyEvent({ id, nexus, push: ctx.push });
        return json(res, 200, { ok: true, message: r.log.join(' · ') });
      }
      json(res, 404, { error: 'Introuvable' });
    } catch (e) {
      json(res, 500, { error: e.message });
    }
  });
  server.on('error', e => {
    // Un écran tourne déjà sur ce port (lancé par une autre session Claude, par exemple) : rien à faire.
    if (e.code === 'EADDRINUSE') { console.log(`Un écran tourne déjà sur le port ${args.port}.`); process.exit(0); }
    throw e;
  });
  server.listen(args.port, args.host, () => {
    console.log(`Écran commun : http://${args.host === '0.0.0.0' ? 'localhost' : args.host}:${args.port}${args.keeper ? '  (mode gate keeper : verdicts et événement)' : ''}`);
    console.log(`Context Nexus : ${nexus}${args.pull ? ` · git pull toutes les ${args.pull} s` : ' · pas de git pull (ajoutez --pull 10)'}${args.push ? ' · publication (push) activée' : ''}`);
  });
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) main();
export { buildState, Tracker, writeVerdict };
