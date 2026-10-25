// Moteur d'état du hackathon : « où en est la squad, que manque-t-il pour la gate, quelle est la prochaine étape ? »
// Une seule source de vérité pour le coach (/coach, /bienvenue), l'écran commun et les hooks.
// Il lit le Context Nexus (obligatoire) et, si on lui donne le dossier du starter, les artefacts Spec Kit.
// Il ne remplace pas `npm run gate-check` (verdict automatique officiel) : il explique et oriente.

import { readFileSync, readdirSync, statSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { execFileSync } from 'node:child_process';
import { loadNexus, squadOf, checkPins, cmpVersion, gateVerdicts, readJournal, minutesOfDay, DEFAULT_TZ } from './nexus.mjs';

// ---------- horaires ----------

const hm = s => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
const fmt = min => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

export function agendaFor(config, squad) {
  const o = config.squads[squad].offsetMin;
  const start = hm('14:00') + o;
  const blocks = [{ id: 'Cadrage', from: hm(config.start), to: hm('14:00') }];
  if (o > 0) blocks.push({ id: 'Mise en route', from: hm('14:00'), to: start });
  let t = start;
  for (const [id, len] of [['Discover', 30], ['Design', 45], ['Pause', 10], ['Develop', 50], ['Deploy', 25]]) {
    blocks.push({ id, from: t, to: t + len });
    t += len;
  }
  if (t < hm('16:55')) blocks.push({ id: 'Bonus', from: t, to: hm('16:55') });
  blocks.push({ id: 'Débrief', from: hm('16:55'), to: hm(config.end) });
  return blocks.map(b => ({ id: b.id, from: fmt(b.from), to: fmt(b.to) }));
}

export function minutesOf(date, tz = DEFAULT_TZ) { return minutesOfDay(date, tz); }

export function blockAt(agenda, now, tz = DEFAULT_TZ) {
  const m = minutesOf(now, tz);
  return agenda.find(b => m >= hm(b.from) && m < hm(b.to)) || null;
}

// ---------- lecture du starter ----------

const read = f => (existsSync(f) ? readFileSync(f, 'utf8') : null);
const PLACEHOLDER = /<[A-Za-zÀ-ÿ][^>\n]{6,}>/;

function countFiles(dir, re, limit = 800) {
  let n = 0;
  const stack = [dir];
  while (stack.length && n < limit) {
    const d = stack.pop();
    if (!existsSync(d)) continue;
    for (const name of readdirSync(d)) {
      if (name === 'node_modules' || name.startsWith('.')) continue;
      const p = join(d, name);
      const st = statSync(p);
      if (st.isDirectory()) stack.push(p);
      else if (re.test(name)) n++;
    }
  }
  return n;
}

export function readMarks(starter) {
  try { return JSON.parse(read(join(starter, '.hackathon', 'done.json')) || '{}'); } catch { return {}; }
}

export function writeMark(starter, key) {
  const dir = join(starter, '.hackathon');
  mkdirSync(dir, { recursive: true });
  const marks = readMarks(starter);
  marks[key] = new Date().toISOString();
  writeFileSync(join(dir, 'done.json'), JSON.stringify(marks, null, 2));
}

function readStarter(starter) {
  if (!starter || !existsSync(starter)) return null;
  const constitution = read(join(starter, '.specify', 'memory', 'constitution.md'));
  const specsDir = join(starter, 'specs');
  const features = existsSync(specsDir)
    ? readdirSync(specsDir).filter(n => statSync(join(specsDir, n)).isDirectory()).sort() : [];
  const feat = features.length ? join(specsDir, features[features.length - 1]) : null;
  const spec = feat ? read(join(feat, 'spec.md')) : null;
  const plan = feat ? read(join(feat, 'plan.md')) : null;
  const tasks = feat ? read(join(feat, 'tasks.md')) : null;
  const done = tasks ? (tasks.match(/^\s*- \[[xX]\]/gm) || []).length : 0;
  const todo = tasks ? (tasks.match(/^\s*- \[ \]/gm) || []).length : 0;
  let flags = null;
  try { flags = JSON.parse(read(join(starter, 'flags.json')) || 'null'); } catch { /* flags.json invalide : ignoré */ }
  return {
    dir: starter,
    constitutionFilled: !!constitution && !/\[(PROJECT_NAME|PRINCIPLE_\d_NAME)\]/.test(constitution),
    feature: feat ? basename(feat) : null,
    spec, plan, tasks, tasksDone: done, tasksTodo: todo,
    brief: read(join(starter, '.context', 'brief.md')),
    testFiles: countFiles(join(starter, 'test'), /\.(test|spec)\.[cm]?[jt]sx?$/) + countFiles(join(starter, 'tests'), /\.(test|spec)\.[cm]?[jt]sx?$/) + countFiles(join(starter, 'src'), /\.(test|spec)\.[cm]?[jt]sx?$/),
    flags,
    marks: readMarks(starter),
  };
}

function signedOff(starter) {
  try {
    const out = execFileSync('git', ['-C', starter, 'log', '--format=%B', '-n', '80'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return /^Signed-off-by:\s*\S+/m.test(out);
  } catch { return false; }
}

// Un contrat de la squad modifié par quelqu'un d'autre (l'événement de l'animation, un correctif du programme) après que la squad
// l'a publié elle-même : le dernier commit qui le touche n'est pas un commit « <squad>: … », alors qu'un commit de la squad existe avant.
// La squad clôt l'alerte en republiant le contrat (c'est aussi ce qui prévient ses consommateurs).
function ownChangedElsewhere(nexus, squad, contracts) {
  const out = [];
  for (const c of contracts) {
    try {
      const subjects = execFileSync('git', ['-C', nexus, 'log', '--format=%s', '--', c.path], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split('\n').filter(Boolean);
      if (subjects.length > 1 && !subjects[0].startsWith(`${squad}:`) && subjects.slice(1).some(x => x.startsWith(`${squad}:`))) out.push({ path: c.path, version: c.meta.version, subject: subjects[0] });
    } catch { /* pas de dépôt Git : pas d'alerte */ }
  }
  return out;
}

function unpublishedChanges(nexus, squad) {
  try {
    const out = execFileSync('git', ['-C', nexus, 'status', '--porcelain', '--', `teams/${squad}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return out.split('\n').filter(Boolean).map(l => l.slice(3));
  } catch { return []; }
}

// ---------- gabarit Business Intent ----------

function intentFields(text) {
  const body = (text || '').replace(/^---\n[\s\S]*?\n---\n?/, '');
  const fields = {};
  const re = /^## ([1-5])\.[^\n]*\n([\s\S]*?)(?=^## |(?![\s\S]))/gm;
  let m;
  while ((m = re.exec(body))) {
    const clean = m[2].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    fields[m[1]] = clean;
  }
  return fields;
}

// ---------- calcul principal ----------

export function computeStatus({ nexus, starter = null, squad, config, now = new Date() }) {
  const cfg = config.squads[squad];
  if (!cfg) throw new Error(`Squad inconnue : ${squad}`);
  const artifacts = loadNexus(nexus);
  const own = [...artifacts.values()].filter(a => squadOf(a.path) === squad);
  const st = readStarter(starter);
  const verdicts = gateVerdicts(nexus, squad);
  const agenda = agendaFor(config, squad);
  const block = blockAt(agenda, now, config.timezone);

  const intentPath = join(nexus, 'teams', squad, 'intent', 'business-intent.md');
  const intentText = read(intentPath);
  const intentFm = artifacts.get(`teams/${squad}/intent/business-intent.md`);
  const fields = intentFields(intentText);
  const filled = ['1', '2', '3', '4', '5'].filter(k => (fields[k] || '').length > 0);
  const ownerOk = !!intentFm && !!intentFm.meta.owner && !/^</.test(intentFm.meta.owner) && intentFm.meta.owner !== squad;
  const specs = own.filter(a => /\/intent\/specs\//.test(a.path));
  const contracts = own.filter(a => a.meta.register === 'contracts' && /\/contracts\//.test(a.path));
  const runbook = artifacts.get(`teams/${squad}/operations/runbook.md`);
  const flagsRows = readJournal(nexus, squad, 'flags-journal.md');

  // Écarts d'épinglage sur les artefacts de la squad
  const neighbors = [];
  const seen = new Set();
  for (const a of own) {
    const issues = new Map(checkPins(a, artifacts).map(i => [i.path, i]));
    for (const ref of a.meta.consumes || []) {
      const [path, pinned] = ref.split('@');
      if (seen.has(path)) continue;
      seen.add(path);
      const target = artifacts.get(path);
      const issue = issues.get(path) || null;
      neighbors.push({
        path, pinned, current: target ? target.meta.version : null, targetStatus: target ? target.meta.status : null,
        owner: squadOf(path) || (path.split('/')[0]), mine: squadOf(path) === squad,
        kind: issue ? issue.kind : null, usedBy: a.path,
      });
    }
  }
  const pinIssues = neighbors.filter(n => n.kind && !n.mine);
  const ownStale = own.filter(a => a.meta.status === 'stale').map(a => a.path);
  const stale = pinIssues.length > 0 || ownStale.length > 0;
  const unpublished = unpublishedChanges(nexus, squad);
  const ownChanged = ownChangedElsewhere(nexus, squad, contracts);
  const pci = cfg.pci;

  // ----- critères par gate : mêmes identifiants et mêmes règles que `npm run gate-check` du starter -----
  // Ce qui se vérifie vite et sans le code (Nexus, fichiers Spec Kit, journal) est calculé ici.
  // Ce qui demande de lancer lint, tests, audit… est marqué `unknown` : seul le gate-check officiel le tranche.
  const crit = (id, label, ok, detail = '', unknown = false) => ({ id, label, ok: !!ok && !unknown, detail, unknown });
  const unk = (id, label) => crit(id, label, false, '', true);
  const filledV = v => !!v && v !== 'null' && !String(v).startsWith('<');
  const anyPinIssue = own.some(a => checkPins(a, artifacts).length > 0);
  const contextOk = !anyPinIssue && ownStale.length === 0;
  const specsOk = specs.some(x => x.meta.status === 'active' && filledV(x.meta.owner));
  const flagsOn = st && st.flags ? Object.entries(st.flags).filter(([, on]) => on).map(([n]) => n) : null;
  const untraced = flagsOn ? flagsOn.filter(n => !flagsRows.some(r => r[1] === n && r[2] === 'on')) : null;
  const runbookText = read(join(nexus, 'teams', squad, 'operations', 'runbook.md')) || '';
  let observable = null;
  if (starter && existsSync(join(starter, 'scripts', 'observe.mjs'))) {
    try { execFileSync('node', ['scripts/observe.mjs'], { cwd: starter, stdio: 'ignore', timeout: 4000 }); observable = true; } catch { observable = false; }
  }
  const auto = {
    G1: [
      crit('G1-1', 'Business Intent Spec publiée', !!intentText, `copier gabarits/business-intent.md dans teams/${squad}/intent/`),
      crit('G1-2', 'statut active et owner nommé', !!intentFm && intentFm.meta.status === 'active' && filledV(intentFm.meta.owner)),
      crit('G1-3', 'contexte daté (last-validated)', !!intentFm && filledV(intentFm.meta['last-validated'])),
      crit('G1-4', '5 champs remplis', filled.length === 5, `champs vides : ${['1', '2', '3', '4', '5'].filter(k => !filled.includes(k)).join(', ') || 'aucun'}`),
      crit('G1-5', 'critère de succès chiffré (champ 3)', filled.includes('3') && /\d/.test(fields['3'] || '')),
    ],
    G2: [
      crit('G2-1', 'spec publiée dans intent/specs/', specs.length > 0, 'voir gabarits/frontmatter-spec.md'),
      crit('G2-2', 'spec active avec owner', specsOk),
      crit('G2-3', 'contrats publiés en v1 (≥ 1.0.0)', contracts.length > 0 && contracts.every(c => Number(String(c.meta.version || '0').split('.')[0]) >= 1), contracts.filter(c => Number(String(c.meta.version || '0').split('.')[0]) < 1).map(c => basename(c.path)).join(', ')),
      crit('G2-4', 'versions épinglées à jour (context-assemble --check)', contextOk, [...pinIssues.map(n => `${basename(n.path)} ${n.pinned} → ${n.current}`), ...ownStale.map(basename)].join(', ') || 'npm run context, puis lire la sortie'),
    ],
    G3: [
      unk('G3-1', 'lint (ENG-01)'), unk('G3-2', 'typecheck'), unk('G3-3', 'tests et couverture ≥ 70 % (ENG-02, ENG-03)'),
      unk('G3-4', 'scan PCI et secrets (SEC-01, SEC-04)'), unk('G3-5', 'dépendances sans vulnérabilité haute (SEC-03)'),
      crit('G3-6', 'spec à jour, rien de stale (context-assemble --check)', contextOk, [...pinIssues.map(n => `${basename(n.path)} ${n.pinned} → ${n.current}`), ...ownStale.map(basename)].join(', ')),
      ...(pci ? [st ? crit('G3-7', 'signature humaine sur le code de débit (SEC-02, PCI-03)', signedOff(starter), 'git commit -s par le Decision Guarantor') : crit('G3-7', 'signature humaine sur le code de débit (SEC-02, PCI-03)', false, '', true)] : []),
    ],
    G4: [
      untraced === null ? crit('G4-1', 'flags activés tracés dans le journal (ENG-05)', false, '', true) : crit('G4-1', 'flags activés tracés dans le journal (ENG-05)', untraced.length === 0, untraced.length ? `sans trace : ${untraced.join(', ')} — utiliser npm run flag` : ''),
      crit('G4-2', 'runbook publié', runbookText.length > 0, 'copier gabarits/runtime-spec.md dans operations/runbook.md'),
      crit('G4-3', 'runbook : owner d\'exploitation et rollback', /owner/i.test(runbookText) && /rollback/i.test(runbookText)),
      observable === null ? crit('G4-4', 'service déployé et observable', false, '', true) : crit('G4-4', 'service déployé et observable', observable, 'npm run deploy'),
    ],
  };
  for (const [g, list] of Object.entries(auto)) for (const c of list) if (c.unknown) c.detail = `à vérifier avec npm run gate-check -- ${g}`;
  const human = {
    G1: ['Le critère de succès chiffré est pertinent et son owner connu', 'Les données nécessaires sont identifiées, avec leurs trous', 'La priorité est justifiée, avec un owner'],
    G2: ['Les exigences non fonctionnelles sont chiffrées', 'La Definition of Ready est tenue', 'La spec est active, avec un owner'],
    G3: ['Une revue nommée a eu lieu', pci ? 'Le code de débit porte une signature humaine nommée' : 'La criticité est qualifiée', 'Le plan de feature flags est écrit'],
    G4: ['Un owner d\'exploitation est nommé', 'Le runbook et le rollback sont écrits', 'La bascule du flag est tracée (Release ≠ Activation)'],
  };

  const gates = {};
  for (const g of Object.keys(config.gates)) {
    const a = auto[g];
    gates[g] = {
      id: g, name: config.gates[g].name, phase: config.gates[g].phase, keeper: config.gates[g].keeper,
      slot: cfg.slots[g], verdict: verdicts[g] || null,
      auto: a, autoOk: a.filter(c => c.ok).length, autoKnown: a.filter(c => !c.unknown).length, autoUnknown: a.filter(c => c.unknown).length, autoTotal: a.length, human: human[g],
    };
  }
  const order = Object.keys(config.gates);
  const nextGate = order.find(g => !(verdicts[g] && verdicts[g].verdict === 'GO')) || null;
  const phase = nextGate ? config.gates[nextGate].phase : 'Deepen · Drop (bonus)';

  const milestones = (config.milestones || []).map(m => {
    const a = artifacts.get(m.artifact);
    return { ...m, current: a ? a.meta.version : null, done: !!a && cmpVersion(a.meta.version, m.minVersion) >= 0 && a.meta.status === 'active' };
  });

  const publishMissing = cfg.g4Publish.filter(p => { const a = artifacts.get(p); return !(a && cmpVersion(a.meta.version, '1.0.0') >= 0); });
  const ctx = { config, squad, cfg, st, publishMissing, fields, filled, intentText, intentFm, ownerOk, specs, contracts, runbook, flagsRows, pinIssues, ownStale, ownChanged, unpublished, nextGate, gates, milestones };
  const step = pickStep(ctx);

  return {
    squad, label: cfg.label, number: cfg.number, volet: cfg.volet, pci,
    now: now.toISOString(), agenda, block: block ? block.id : null,
    phase, nextGate, gates, step, neighbors, pinIssues, ownStale, ownChanged, stale, unpublished, milestones,
    starter: st ? { feature: st.feature, tasksDone: st.tasksDone, tasksTodo: st.tasksTodo, testFiles: st.testFiles, briefOk: !!(st.brief && /Task brief TB-/.test(st.brief)), welcomed: !!st.marks.welcomed } : null,
    own: { intent: intentFm ? { status: intentFm.meta.status, owner: intentFm.meta.owner } : null, specs: specs.map(s => ({ path: s.path, status: s.meta.status })), contracts: contracts.map(c => ({ path: c.path, version: c.meta.version, status: c.meta.status })) },
  };
}

// ---------- catalogue des étapes ----------
// Les étiquettes Intent, Clarify, Design, Decompose, Check, Implement, Converge sont celles de la page participants.

const NX = '../context-nexus';

function pickStep(c) {
  const { st, cfg, squad, nextGate, gates, pinIssues } = c;
  const S = (id, label, hat, command, why, humanChecks, extra = {}) => ({ id, label, hat, command, why, human: humanChecks, ...extra });

  if (st && !(st.brief && /Task brief TB-/.test(st.brief))) {
    return S('assemble', 'Assembler le contexte', 'Context Engineer',
      `git -C ${NX} pull && node ${NX}/tools/context-assemble.mjs --squad ${squad} --out .context/brief.md`,
      'L\'agent ne connaît ni Vélora ni les autres squads : c\'est ce brief qui lui donne les règles, les contrats et leurs versions.',
      ['Le brief cite bien votre volet et les contrats des autres squads']);
  }

  if (c.ownChanged.length) {
    const o = c.ownChanged[0];
    return S('own-changed', 'Réagir : votre propre contrat a changé sans passer par vous', 'Context Engineer',
      `git -C ${NX} pull && git -C ${NX} log -p -1 -- ${o.path}`,
      `Votre contrat est la promesse faite aux autres squads. Il est passé en ${o.version} (« ${o.subject} ») : votre spec, vos tests et votre code décrivent encore l'ancienne version. Lire CE qui a changé avant d'écrire une ligne de plus.`,
      ['Le changement est lu à voix haute devant la squad', 'Exigences, critères d\'acceptance, tâches, mocks et tests touchés sont identifiés et mis à jour', 'Le contrat est complété (schéma, exemples) par un humain de la squad puis republié : c\'est ce qui prévient les autres squads et clôt cette alerte'],
      { followUp: `/speckit-clarify Notre contrat ${o.path} est passé en ${o.version} par un changement venu d'ailleurs (voir git -C ${NX} log -p -1 -- ${o.path}). Quelles exigences, quels critères d'acceptance, quelles tâches, quels mocks et quels tests de notre spec sont impactés ?`, items: c.ownChanged.map(x => `${x.path} ${x.version} (${x.subject})`) });
  }

  if (pinIssues.length) {
    const n = pinIssues[0];
    return S('react', 'Réagir : un contrat d\'une autre squad a changé', 'Context Engineer',
      `git -C ${NX} pull && node ${NX}/tools/context-assemble.mjs --squad ${squad} --mark-stale --out .context/brief.md && git -C ${NX} log -p -3 -- teams/`,
      'Lire CE qui a changé, pas seulement QUE ça a changé : c\'est ce qui évite de coder sur un contrat périmé (règle n°7 de Vélora).',
      ['Le diff du contrat est lu à voix haute devant la squad', 'La squad a identifié les exigences, critères et tâches touchés', 'Le contrat d\'une autre squad est épinglé à sa nouvelle version, puis la spec repasse en active'],
      { followUp: `/speckit-clarify Le contrat ${n.path} est passé de la version ${n.pinned} à ${n.current} (voir .context/brief.md). Quelles exigences, quels critères d'acceptance et quelles tâches de notre spec sont impactés ?`, items: pinIssues.map(x => `${x.path} ${x.pinned} → ${x.current} (${x.kind})`) });
  }

  if (!nextGate) {
    return S('bonus', 'Deepen et Drop (bonus)', 'Decision Guarantor', '', 'Les quatre gates sont passées : place au verdict G5 sur 30 jours de télémétrie et au retrait de l\'ancien processus (G6), en version courte ou à l\'oral.',
      ['Le verdict est mesuré face au critère chiffré de G1']);
  }

  const gateReady = gates[nextGate].autoOk === gates[nextGate].autoTotal;
  const GATE = () => S('gate', `Passer ${nextGate} · ${gates[nextGate].name}`, 'Decision Guarantor', `npm run gate-check -- ${nextGate}`,
    `Lancez le gate-check officiel : s'il est au vert, le gate keeper ${gates[nextGate].keeper} vous attend à ${gates[nextGate].slot}. Il juge ce qu'une machine ne peut pas juger.`,
    gates[nextGate].human, { slot: gates[nextGate].slot });

  if (nextGate === 'G1') {
    if (!c.intentText) return S('intent-copy', 'Intent : copier le gabarit', 'Specification Engineer',
      `cp ${NX}/gabarits/business-intent.md ${NX}/teams/${squad}/intent/business-intent.md`,
      'Un besoin écrit en 5 champs oblige à choisir : problème, utilisateurs, succès chiffré, données, priorité.',
      ['Le fichier est dans le dossier de votre squad, pas ailleurs']);
    if (c.filled.length < 5 || PLACEHOLDER.test(c.intentText.replace(/^---\n[\s\S]*?\n---\n?/, ''))) return S('intent-fill', 'Intent : remplir les 5 champs', 'Specification Engineer',
      'Lis .context/brief.md. Liste ce que le brief ne dit pas et qui empêche de fixer un critère de succès chiffré pour notre volet. Pour chaque point, dis quelle donnée ou quelle squad pourrait y répondre. Ne rédige pas la Business Intent Spec : pose les questions.',
      'Le brief est volontairement flou. L\'agent pose les questions, la squad décide : l\'Intent reste humain.',
      ['Le critère de succès est chiffré (valeur, seuil, horizon) et son auteur est connu', 'Chaque affirmation est datée et sourcée', 'Ce que le brief ne dit pas est marqué « à confirmer », pas inventé'],
      { items: c.filled.length < 5 ? [`${c.filled.length} champ(s) sur 5 remplis`] : ['Il reste du texte du gabarit entre < >'] });
    if (!c.ownerOk || c.intentFm.meta.status !== 'active') return S('intent-sign', 'Intent : relire, signer, passer en active', 'Specification Engineer',
      `Dans le frontmatter : owner: <prénom.nom>, status: active, last-validated: ${c.config.date}`,
      'Une spec que personne n\'a relue n\'est pas une spec : un humain nommé s\'engage.',
      ['La squad a relu les 5 champs à voix haute', 'Un humain nommé est owner']);
    if (c.unpublished.length) return S('publish', 'Publier dans le Nexus', 'Context Engineer',
      `node ${NX}/tools/publish.mjs -m "publie business-intent v1.0.0"`,
      'Ce qui n\'est pas publié reste invisible pour les autres squads et pour le gate keeper.', ['Le diff publié ne touche que teams/' + squad + '/']);
    return GATE();
  }

  if (nextGate === 'G2') {
    if (st && !st.constitutionFilled) return S('constitution', 'Constitution : les principes du projet', 'Context Engineer',
      `/speckit-constitution Construis la constitution uniquement à partir des règles et contracts de la section "system prompt" de .context/brief.md. Chaque principe cite l'ID de sa source (ex. SEC-02, API-02, ENG-04). N'ajoute aucun principe qui n'y figure pas : s'il en manque un, signale-le.`,
      'La constitution fixe ce que l\'agent n\'a pas le droit de négocier. Elle vient du Nexus, pas de son imagination.',
      ['Chaque principe cite l\'ID de sa source', 'Aucun principe n\'a été inventé par l\'agent']);
    if (st && !st.spec) return S('specify', 'Intent : la spec fonctionnelle', 'Specification Engineer',
      `/speckit-specify ${cfg.specifySeed}\nSource : teams/${squad}/intent/business-intent.md. Critères d'acceptance vérifiables par un test, chacun rattaché à une règle RM-xx ou à un contract (API-xx, SEC-xx, A11Y-xx, ENG-xx).`,
      'La spec dit le quoi et le pourquoi, pas le comment. C\'est elle, et non un ticket, qui devient l\'unité de travail.',
      ['Chaque critère d\'acceptance peut être vérifié par un test automatique', 'Aucune règle métier n\'a été devinée : les trous sont marqués [NEEDS CLARIFICATION]', 'Le critère de succès de G1 est repris tel quel']);
    if (st && (!/## Clarifications/.test(st.spec) || /\[NEEDS CLARIFICATION/.test(st.spec))) return S('clarify', 'Clarify : lever les ambiguïtés', 'toute la squad',
      '/speckit-clarify', 'Mieux vaut trouver maintenant ce que la spec laisse flou qu\'après le code. Ce qui touche une autre squad se règle en allant la voir.',
      ['Chaque question a une réponse écrite', 'Les réponses qui touchent une autre squad sont validées avec elle', 'Aucun chiffre sans source'],
      { items: cfg.questions });
    if (st && !st.plan) return S('plan', 'Design : le plan technique', 'Specification Engineer + Orchestrator',
      `/speckit-plan Stack : celle du starter (TypeScript, tests et CI fournis). Les contrats des autres squads sont dans .context/brief.md, en versions épinglées : tu les consommes tels quels, tu ne les modifies pas. Pour chaque champ échangé avec une autre squad, vérifie type, unité et format, et liste les écarts trouvés.`,
      'Le plan choisit le comment. Les écarts de type, d\'unité ou de format avec les autres squads se trouvent ici, avant d\'être des bugs.',
      ['Chaque champ échangé a un type, une unité et un exemple (API-02)', 'Les écarts avec les autres squads sont réglés avec elles, ou notés en question ouverte']);
    if (st && !st.tasks) return S('tasks', 'Decompose : les tâches', 'Agentic Workflow Orchestrator',
      '/speckit-tasks', 'Des tâches courtes, ordonnées, testables une à une : c\'est ce qui rend le travail de l\'agent vérifiable.',
      ['Chaque tâche est testable seule', 'Il y en a peu : le volet est volontairement fin']);
    if (st && !st.marks.analyze) return S('analyze', 'Check : la cohérence', 'Decision Guarantor relit',
      '/speckit-analyze', 'Contrôle que spec, plan, tâches et constitution racontent la même histoire avant d\'écrire du code. Dites « analyze fait » à /coach pour le cocher.',
      ['Le rapport est lu en entier', 'Chaque incohérence critique est corrigée']);
    if (!c.specs.some(s => s.meta.status === 'active')) return S('spec-publish', 'Publier la spec dans le Nexus', 'Specification Engineer',
      `Copiez specs/${st ? st.feature : '001-…'}/spec.md dans ${NX}/teams/${squad}/intent/specs/${squad}-001.md et ajoutez en tête le frontmatter de ${NX}/gabarits/frontmatter-spec.md`,
      'La spec publiée est ce que les autres squads et les gate keepers peuvent lire, et ce que le Nexus surveille quand une autre squad change.',
      ['Toutes les versions de contrats des autres squads utilisées sont épinglées dans consumes', 'Un owner nommé, statut active']);
    if (!(c.contracts.length && c.contracts.every(x => cmpVersion(x.meta.version, '1.0.0') >= 0 && x.meta.status === 'active'))) return S('contract-v1', 'Publier votre contrat v1', 'Specification Engineer',
      `Suivez ${NX}/gabarits/contrat-v1-checklist.md : version 1.0.0, status active, consumes épinglé sur les versions actuelles, mock disponible pour les autres squads`,
      'Un contrat v1 imparfait publié tôt vaut mieux qu\'un contrat parfait gardé pour soi : les autres squads construisent dessus.',
      ['Chaque champ a un type, une unité et un exemple', 'Les consommateurs sont à jour', 'Un mock est disponible (API-05)']);
    if (c.unpublished.length) return S('publish', 'Publier dans le Nexus', 'Context Engineer',
      `node ${NX}/tools/publish.mjs -m "publie contrat v1 et spec"`,
      'Ce qui n\'est pas publié reste invisible pour les autres.', ['Le diff publié ne touche que teams/' + squad + '/']);
    return GATE();
  }

  if (nextGate === 'G3') {
    if (st && st.tasksTodo > 0) return S('implement', 'Implement : tâche par tâche', 'Agentic Workflow Orchestrator',
      '/speckit-implement', `Une tâche, un test, un commit : il reste ${st.tasksTodo} tâche(s). Si un contrat d'une autre squad change, votre coach vous le dira, et ce tableau aussi.`,
      ['Chaque critère d\'acceptance a un test nommé qui le référence (ENG-04)', 'Les tests sont verts avant chaque commit'], { remaining: st.tasksTodo });
    if (st && st.testFiles === 0) return S('tests', 'Des tests nommés d\'après vos critères', 'Agentic Workflow Orchestrator',
      'Écris un test par critère d\'acceptance de la spec, nommé d\'après lui, puis lance npm test.',
      'Un critère sans test n\'est qu\'une intention (ENG-04).', ['Chaque test cite le critère qu\'il couvre']);
    if (c.cfg.pci && st && !signedOff(st.dir)) return S('sign', 'Signature humaine du code de débit', 'Decision Guarantor',
      'git commit -s -m "…"   # ajoute Signed-off-by: <prénom nom>',
      'Le code qui déclenche un débit est signé par un humain nommé avant d\'être fusionné (SEC-02, PCI-03). L\'agent ne signe jamais à votre place.',
      ['Le Decision Guarantor a relu le code de débit', 'Son nom figure dans le commit']);
    return GATE();
  }

  if (nextGate === 'G4') {
    if (!c.runbook) return S('runbook', 'Runbook et rollback', 'Decision Guarantor',
      `cp ${NX}/gabarits/runtime-spec.md ${NX}/teams/${squad}/operations/runbook.md`,
      'Déployer sans runbook, c\'est livrer sans savoir comment revenir en arrière.',
      ['Un owner d\'exploitation est nommé', 'Le rollback tient en une commande']);
    if (!c.flagsRows.length) return S('flag', 'Déployer, puis basculer le flag (un humain)', 'Decision Guarantor',
      'npm run deploy   puis   npm run flag -- <nom> on --reason "…"',
      'Release ≠ Activation : déployer et activer sont deux décisions. La bascule est tracée (qui, quand, pourquoi) et réservée à un humain.',
      ['La ligne du journal porte un nom, une heure et un motif']);
    const miss = c.publishMissing[0];
    if (miss) return S('kpi-publish', `Publier ${basename(miss, '.md')} en v1`, 'Specification Engineer',
      `Mettez à jour ${NX}/${miss} (version 1.0.0) puis publiez`, 'Ce que vous instrumentez est ce que les autres squads liront pour mesurer la valeur.', ['Chaque indicateur a sa définition et sa source']);
    return GATE();
  }
  return GATE();
}

// ---------- rendus ----------

export function renderLine(s) {
  let g = 'toutes les gates passées';
  if (s.nextGate) {
    const x = s.gates[s.nextGate];
    g = x.autoUnknown && x.autoOk === x.autoKnown ? `${s.nextGate} : gate-check à lancer` : `${s.nextGate} ${x.autoOk}/${x.autoKnown}`;
  }
  const n = s.pinIssues.length;
  const o = s.ownChanged || [];
  return `${s.label} · ${s.phase} · ${g}${o.length ? ` · ⚡ votre contrat ${o.map(x => `${x.path.split('/').pop().replace(/\.md$/, '')} est passé en ${x.version}`).join(', ')} sans passer par vous` : ''}${n ? ` · ${n} contrat(s) d'une autre squad à relire` : ''}`;
}

export function renderText(s, { welcome = false, config } = {}) {
  const L = [];
  const block = s.block ? ` · bloc en cours : ${s.block}` : '';
  L.push(`SQUAD : ${s.squad} (${s.label}) · volet : ${s.volet}${block}`);
  L.push(`PHASE : ${s.phase}${s.nextGate ? ` · prochaine gate ${s.nextGate} « ${s.gates[s.nextGate].name} » à ${s.gates[s.nextGate].slot}` : ''}`);
  L.push('');
  const st = s.step;
  L.push(`PROCHAINE ÉTAPE : ${st.label}  [chapeau : ${st.hat}]`);
  if (st.command) L.push(`  À taper ou à coller :\n${st.command.split('\n').map(l => '    ' + l).join('\n')}`);
  if (st.followUp) L.push(`  Ensuite :\n    ${st.followUp}`);
  if (st.items && st.items.length) L.push('  Points à regarder :\n' + st.items.map(i => `    - ${i}`).join('\n'));
  L.push(`  Pourquoi : ${st.why}`);
  if (st.human && st.human.length) L.push('  À relire par un humain :\n' + st.human.map(i => `    - ${i}`).join('\n'));
  L.push('');
  L.push('GATES :');
  for (const g of Object.values(s.gates)) {
    const v = g.verdict ? `${g.verdict.verdict} (${g.verdict.at.slice(11, 16)}, ${g.verdict.keeper})` : `${g.autoOk}/${g.autoKnown} critères vérifiés ici${g.autoUnknown ? `, ${g.autoUnknown} à vérifier avec le gate-check` : ''}`;
    L.push(`  ${g.id} ${g.name} · créneau ${g.slot} · ${v}`);
    if (g.id === s.nextGate) for (const c of g.auto) L.push(`    ${c.unknown ? '[?]' : (c.ok ? '[x]' : '[ ]')} ${c.id} ${c.label}${c.detail && !c.ok ? ` (${c.detail})` : ''}`);
  }
  if (s.pinIssues.length) {
    L.push('');
    L.push('CONTRATS DES AUTRES SQUADS À RELIRE :');
    for (const n of s.pinIssues) L.push(`  ${n.path} : épinglé ${n.pinned}, actuel ${n.current} (${n.kind})`);
  }
  const lateMs = s.milestones.filter(m => !m.done);
  if (lateMs.length) {
    L.push('');
    L.push('JALONS COMMUNS :');
    for (const m of lateMs) L.push(`  ${m.id} ${m.label} avant ${m.due} (${m.artifact})`);
  }
  if (s.unpublished.length) { L.push(''); L.push(`NON PUBLIÉ dans le Nexus : ${s.unpublished.join(', ')}`); }
  if (welcome && config) {
    L.push('');
    L.push('CHAPEAUX À RÉPARTIR (un par personne, ajustez au cadrage) :');
    for (const [h, d] of Object.entries(config.hats)) L.push(`  ${h} : ${d}`);
    L.push('');
    L.push('JOURNÉE DE VOTRE SQUAD :');
    for (const b of s.agenda.filter(b => ['Discover', 'Design', 'Pause', 'Develop', 'Deploy', 'Bonus'].includes(b.id))) L.push(`  ${b.from}-${b.to} ${b.id}`);
    L.push('  Gates : ' + Object.values(s.gates).map(g => `${g.id} ${g.slot}`).join(' · '));
  }
  return L.join('\n');
}

export function environmentChecks({ nexus, starter, squad }) {
  const checks = [];
  const major = Number(process.versions.node.split('.')[0]);
  checks.push({ id: 'node', ok: major >= 20, detail: `Node ${process.versions.node}` });
  const brief = starter ? read(join(starter, '.context', 'brief.md')) : null;
  const tb = brief && brief.match(/Task brief (TB-[\w-]+)/);
  checks.push({ id: 'brief', ok: !!tb, detail: tb ? tb[1] : 'absent : lancez npm run context' });
  checks.push({ id: 'claude-md', ok: !!(starter && existsSync(join(starter, 'CLAUDE.md'))), detail: 'CLAUDE.md à la racine du starter' });
  checks.push({ id: 'nexus', ok: existsSync(join(nexus, 'teams', squad)), detail: `Context Nexus : ${nexus}` });
  let sk = false;
  try { execFileSync('specify', ['--version'], { stdio: 'ignore' }); sk = true; } catch { sk = starter ? existsSync(join(starter, '.specify')) : false; }
  checks.push({ id: 'speckit', ok: sk, detail: 'Spec Kit (commandes /speckit-…)' });
  return checks;
}
