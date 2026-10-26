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
  const retours = readJournal(nexus, squad, 'retours.md');

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
    G1: ['Le critère de succès chiffré est pertinent, lié à un objectif métier, et on sait qui l\'a fixé',
      'Chaque donnée nécessaire a sa disponibilité : disponible, à acquérir ou bloquée',
      'La réutilisation est examinée : une solution existante est nommée, ou son absence justifiée',
      'La priorité est décidée, avec un owner nommé'],
    G2: ['Les exigences non fonctionnelles (NFR : performance, disponibilité, accessibilité…) sont chiffrées, sans adjectif',
      'La Definition of Ready (DoR) est tenue : la spec est prête à être codée (critères testables par un agent, versions épinglées, questions closes)',
      'La spec est active, avec un owner'],
    G3: ['Une revue nommée a eu lieu (qui a relu, humain ou agent)',
      'L\'implémentation colle à la spec : chaque écart et chaque composant inventé est signalé',
      pci ? 'Le code de débit porte une signature humaine nommée (périmètre PCI)' : 'La criticité est qualifiée (ce que coûterait une erreur : c\'est elle qui dit qui doit approuver)',
      'Le plan de flags est écrit : ce qui est livré, ce qui est activé, et quand on revient en arrière'],
    G4: ['Un owner d\'exploitation est nommé, avec runbook et rollback',
      'La bascule du flag est tracée : qui, quand, pourquoi (Release ≠ Activation)',
      'Les KPI promis en G1 sont instrumentés',
      'Le coût IA de l\'incrément est relevé, et lu avec la qualité'],
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
  const ctx = { config, squad, cfg, st, nexus, starterDir: st ? st.dir : null, publishMissing, retours, block: block ? block.id : null, runbookText, fields, filled, intentText, intentFm, ownerOk, specs, contracts, runbook, flagsRows, pinIssues, ownStale, ownChanged, unpublished, nextGate, gates, milestones };
  const step = withSay(pickStep(ctx), ctx);

  return {
    squad, label: cfg.label, number: cfg.number, volet: cfg.volet, pci,
    now: now.toISOString(), agenda, block: block ? block.id : null,
    phase, nextGate, gates, step, neighbors, pinIssues, ownStale, ownChanged, stale, unpublished, milestones, fileMap: fileMap(squad, nexus),
    starter: st ? { feature: st.feature, tasksDone: st.tasksDone, tasksTodo: st.tasksTodo, testFiles: st.testFiles, briefOk: !!(st.brief && /Task brief TB-/.test(st.brief)), welcomed: !!st.marks.welcomed } : null,
    own: { intent: intentFm ? { status: intentFm.meta.status, owner: intentFm.meta.owner } : null, specs: specs.map(s => ({ path: s.path, status: s.meta.status })), contracts: contracts.map(c => ({ path: c.path, version: c.meta.version, status: c.meta.status })) },
  };
}

// ---------- ce que le participant dit à Claude ----------
// Un participant ne tape pas de commande shell : il parle à Claude (ou tape une commande Spec Kit, qui fait partie de
// ce qu'il apprend). `say` est la phrase à taper ; `humanDo`, le geste que seul un humain peut faire ; `command` reste
// ce que Claude lance pour lui.

export const PHASES = {
  Discover: { n: 1, goal: 'Comprendre le besoin et le chiffrer, avant toute solution', output: 'la Business Intent Spec (5 champs, critère de succès chiffré)' },
  Design: { n: 2, goal: 'Concevoir avant de coder, et s\'aligner avec les autres squads', output: 'la spec, le plan et les tâches (Spec Kit), et votre contrat v1 publié' },
  Develop: { n: 3, goal: 'Coder tâche par tâche avec l\'agent, tests compris, sans jamais coder sur un contrat périmé', output: 'le code, ses tests et une spec à jour' },
  Deploy: { n: 4, goal: 'Livrer, puis activer par une décision humaine tracée', output: 'le service déployé, le flag activé, le runbook, les KPI publiés' },
};

function withSay(step, c) {
  const flag = c.st && c.st.flags ? Object.keys(c.st.flags)[0] : '<nom-du-flag>';
  const SAY = {
    assemble: ['Mets à jour le contexte'],
    'own-changed': ['Notre contrat a changé sans nous : montre-nous ce qui a changé et ce que ça touche dans notre spec'],
    react: [c.pinIssues[0] && !c.pinIssues[0].path.startsWith('teams/') ? `${c.pinIssues[0].path.split('/').pop()} a changé dans le Nexus : montre-nous le changement, ce qu'il touche chez nous, et mets à jour notre épinglage` : 'Un contrat d\'une autre squad a changé : montre-nous le changement et ce qu\'il touche chez nous'],
    bonus: ['Préparons le bonus : le verdict G5 et le retrait G6, en version courte'],
    gate: [`Vérifie qu'on passe la gate ${c.nextGate}`],
    'intent-copy': ['Aide-nous à écrire notre Business Intent Spec : copie le gabarit dans notre dossier, remplis ce que le Context Nexus permet de remplir en citant le fichier, puis donne-nous les questions à poser à la Direction Revenu Annexe'],
    'intent-fill': ['Voici les réponses de la Direction Revenu Annexe : (collez-les). Complète la Business Intent Spec avec, puis dis-nous la prochaine décision qui nous revient'],
    'intent-sign': ['Nous avons relu la Business Intent Spec ensemble. Je la signe en tant que (prénom nom), owner de l\'intention.',
      'Avant d\'écrire cette phrase, relisez les 5 champs à voix haute en squad. C\'est cette phrase, écrite par la personne nommée, qui l\'engage : l\'agent ne signe jamais de lui-même.'],
    publish: ['Publie nos changements dans le Context Nexus'],
    'spec-publish': ['Publie notre spec dans le Context Nexus, avec son en-tête et nos épinglages'],
    'contract-v1': ['Prépare notre contrat v1 en suivant la checklist, puis montre-le-nous pour qu\'on le relise',
      'Une fois le contrat relu, la personne qui en répond écrit : « Je signe le contrat en tant que (prénom nom) ». C\'est sa signature.'],
    tests: ['Écris un test par critère d\'acceptance, nommé d\'après lui, puis lance les tests'],
    sign: ['Prépare le commit du code de débit : notre Decision Guarantor va le signer',
      'Le Decision Guarantor relit le code de débit, puis tape lui-même dans le terminal : git commit -s -m "…"'],
    runbook: ['Rédige notre runbook à partir du gabarit et de la spec : owner d\'exploitation et rollback'],
    flag: ['Déploie le service',
      `Ensuite, un humain active la fonctionnalité en tapant lui-même dans le terminal : npm run flag -- ${flag} on --reason "pourquoi maintenant"`],
    'kpi-publish': [`Publie notre contrat ${step.label.replace(/^Publier | en v1$/g, '')} en v1`],
    retour: [`Fiche de retour ${step.gate} : pour nous, les critères de la gate étaient (clairs / en partie clairs / flous) ; le critère le moins clair : (facultatif)`],
    'retour-final': ['Fiche de retour de fin de session : (pour chaque point, oui / en partie / non) rythme tenable ; cadrage du début utile ; gates de 5 minutes adaptées ; critères des gates clairs ; responsabilités claires ; contexte partagé utile ; je saurai expliquer ce déroulé à mon équipe au 8 h. À changer : … À garder : … Le moment où l\'on s\'est dit « ce n\'est pas comme chez nous » : …'],
    nogo: [`Le gate keeper a dit NO-GO à ${c.nextGate}${step.note ? ` : « ${step.note} »` : ''}. Aide-nous à corriger ce point, publie la correction, puis vérifie qu'on passe la gate`],
    'spec-learn': ['Compare notre code à la spec : liste les écarts et les composants inventés ou adaptés, mets la spec à jour, puis montre-nous ce qui a changé'],
    cost: ['Ajoute à notre runbook le coût IA de l\'incrément : voici la consommation affichée par Claude : (collez-la)',
      'Relevez la consommation de la session dans la barre de gauche de Claude (rubrique « Session ») et collez-la : c\'est vous qui la lisez, pas l\'agent.'],
  };
  const x = SAY[step.id];
  const base = x ? { ...step, say: x[0], humanDo: x[1] || null } : { ...step, say: step.command || '' };   // étapes Spec Kit : la commande /speckit-… est ce qu'on tape
  const L = LEARN[step.id] || [];
  let cue = L[1] ? L[1].replace('teams › votre squad', `teams › ${c.squad}`) : null;
  if (step.id === 'retour') cue = step.verdict === 'GO'
    ? `Convention du TOM : le livrable d'une phase est l'entrée de la suivante. ${HANDOVER[step.gate] || ''} Après cette fiche, ${NEW_SESSION} : la nouvelle phase repart d'un contexte propre et du brief à jour, et coûte moins.`
    : `Sur ${SCREEN}, la gate est rouge avec son motif : c'est la prochaine chose à corriger.`;
  const a = ACCOR[step.id];
  const accor = typeof a === 'function' ? a(c) : a;
  return { ...base, learn: L[0] || null, cue, hatDoes: HAT_DOES[step.id] || null, hatDef: hatDefinition(step.hat, c.config), checkpoint: CHECKPOINT[step.id] || null, accor: accor ? `Chez Accor, ${accor}` : null, files: filesFor(step, c) };
}

// Où sont les documents dont parle l'étape, tels que le participant les voit dans l'explorateur de fichiers, à gauche :
// le Context Nexus y est le dossier context-nexus/ du starter (les commandes, elles, passent par ../context-nexus).
// Le coach cite ces chemins pour que la squad aille ouvrir le document au lieu de le chercher.
export const NEXUS_SHOWN = 'context-nexus';
const KNOWLEDGE = 'programme/late-checkout/knowledge';

function filesFor(step, c) {
  const t = `teams/${c.squad}`;
  const feat = `specs/${c.st && c.st.feature ? c.st.feature : '<numéro>-<nom>'}`;
  const N = (label, p) => ({ label, path: `${NEXUS_SHOWN}/${p}`, exists: c.nexus ? existsSync(join(c.nexus, p)) : null });
  const S = (label, p) => ({ label, path: p, exists: c.starterDir && !p.includes('<') ? existsSync(join(c.starterDir, p)) : null });
  const intent = N('Business Intent Spec', `${t}/intent/business-intent.md`);
  const brief = S('Brief assemblé (le contexte que lit l\'agent)', '.context/brief.md');
  const spec = S('Spec', `${feat}/spec.md`);
  const plan = S('Plan', `${feat}/plan.md`);
  const tasks = S('Tâches', `${feat}/tasks.md`);
  const published = c.specs.length ? c.specs.map(s => N('Spec publiée', s.path)) : [N('Spec publiée', `${t}/intent/specs/${c.squad}-001.md`)];
  const contracts = c.contracts.map(x => N(`Contrat ${basename(x.path, '.md')}`, x.path));
  const runbook = N('Runbook', `${t}/operations/runbook.md`);
  const flags = [S('Flags du service', 'flags.json'), N('Journal des flags', `${t}/operations/flags-journal.md`)];
  const code = [S('Code', 'src/'), S('Tests', 'test/')];
  const retours = [N('Fiches de retour de la squad', `${t}/operations/retours.md`)];
  const byGate = { G1: [intent], G2: [...published, ...contracts], G3: [spec, ...code], G4: [runbook, ...flags] };
  const F = {
    assemble: [brief],
    'own-changed': [...c.ownChanged.map(o => N('Votre contrat, modifié', o.path)), spec],
    react: [...c.pinIssues.map(n => N(`Document modifié (${basename(n.path, '.md')})`, n.path)), brief],
    'intent-copy': [intent, N('Gabarit', 'gabarits/business-intent.md'), N('Décisions déjà prises', `${KNOWLEDGE}/decisions-deja-prises.md`)],
    'intent-fill': [intent, N('Décisions déjà prises', `${KNOWLEDGE}/decisions-deja-prises.md`), N('Règles métier (RM-xx)', `${KNOWLEDGE}/regles-metier.md`)],
    'intent-sign': [intent],
    publish: c.unpublished.map(p => N('À publier', p)),
    gate: byGate[c.nextGate] || [],
    nogo: byGate[c.nextGate] || [],
    constitution: [S('Constitution', '.specify/memory/constitution.md'), brief],
    specify: [spec, intent],
    clarify: [spec],
    plan: [plan, spec],
    tasks: [tasks],
    analyze: [spec, plan, tasks],
    'spec-publish': [spec, ...published, N('Gabarit d\'en-tête', 'gabarits/frontmatter-spec.md')],
    'contract-v1': [...contracts, N('Checklist du contrat v1', 'gabarits/contrat-v1-checklist.md')],
    implement: [tasks, ...code],
    tests: [S('Tests', 'test/'), spec],
    'spec-learn': [spec, ...published],
    sign: [S('Code', 'src/')],
    runbook: [runbook, N('Gabarit', 'gabarits/runtime-spec.md')],
    flag: flags,
    cost: [runbook],
    'kpi-publish': c.publishMissing.slice(0, 1).map(p => N('Contrat à publier', p)),
    retour: retours,
    'retour-final': retours,
    bonus: [intent],
  };
  return (F[step.id] || []).slice(0, 4);
}

// Les grands dossiers, pour l'accueil : où chercher quoi, une fois pour toutes.
function fileMap(squad, nexus) {
  const t = `${NEXUS_SHOWN}/teams/${squad}`;
  let knowledge = [];
  try { knowledge = readdirSync(join(nexus, KNOWLEDGE)).filter(n => n.endsWith('.md')).sort(); } catch { /* Nexus incomplet : on donne le dossier seul */ }
  return [
    ['Le Context Nexus, partagé par les 4 squads', `${NEXUS_SHOWN}/`],
    ['Votre dossier dans le Nexus', `${t}/ (intent/, contracts/, operations/)`],
    ['Les faits, les règles et les décisions déjà prises', `${NEXUS_SHOWN}/${KNOWLEDGE}/${knowledge.length ? ` (${knowledge.join(', ')})` : ''}`],
    ['Les règles de l\'organisation (sécurité, ingénierie, accessibilité)', `${NEXUS_SHOWN}/org/`],
    ['Les gabarits', `${NEXUS_SHOWN}/gabarits/`],
    ['Votre Business Intent Spec, en Discover', `${t}/intent/business-intent.md`],
    ['Votre spec, votre plan et vos tâches, en Design (Spec Kit)', 'specs/'],
    ['Le brief que lit l\'agent', '.context/brief.md'],
  ];
}

// Le pont avec le terrain : où l'étape vivrait chez Accor, d'après le TOM V1.0 (outils en place ou cible).
// Le hackathon simule tout dans le Context Nexus ; cette ligne dit où le participant le retrouvera dans son quotidien.
const GATE_ACCOR = {
  G1: 'cela vivrait au Product weekly du vendredi : le ticket du besoin passe « Ready to spec » dans Jira ; accountable : le Product Manager.',
  G2: 'cela vivrait au Sprint Planning : DoR confirmée, owner du task brief nommé ; accountable : PO, UX et Tech Lead.',
  G3: 'cela vivrait dans la merge request GitLab : GitLab CI, SonarQube, Semgrep, GitLeaks et Checkmarx y tournent à chaque MR ; accountable : développeurs et QA, avec le CAB en périmètre PCI.',
  G4: 'cela vivrait dans ServiceNow (qualification des tests, change) et dans la trace de chaque bascule de flag ; accountable : QA et équipes POE.',
};
const ACCOR = {
  assemble: 'cela vivrait dans le Context Nexus et son Assembler (cible du TOM), avec GitLab, Jira et ServiceNow déjà branchés aux agents par MCP.',
  'own-changed': 'cela vivrait dans GitLab : la merge request qui change un contrat déclenche la revue des directives qu\'il touche ; un désaccord remonte à l\'Architecture biweekly.',
  react: 'cela vivrait dans GitLab : la merge request qui change un contrat déclenche la revue des directives qu\'il touche ; un désaccord remonte à l\'Architecture biweekly.',
  'intent-copy': 'cela vivrait dans le Discovery Backlog (Jira) : le besoin y entre comme ticket, la Business Intent Spec le cadre, et la priorité se tranche au Product weekly (PO, Tech Lead, Product Designer, DSM).',
  'intent-fill': 'cela vivrait dans le Discovery Backlog (Jira) : les chiffres viennent des échanges avec le métier, et la priorité se tranche au Product weekly (PO, Tech Lead, Product Designer, DSM).',
  'intent-sign': 'cela vivrait dans le ticket Jira du besoin : le Product Manager, accountable de G1, l\'engage avant le passage « Ready to spec ».',
  publish: 'cela vivrait dans une merge request sur le dépôt du Context Nexus : ce qui n\'y est pas fusionné n\'existe pas pour les agents ni pour les autres équipes.',
  gate: c => GATE_ACCOR[c.nextGate] || null,
  nogo: 'cela vivrait dans le retour du ticket à l\'étape concernée, critère manquant nommé ; un désaccord remonte au rituel d\'escalade de la gate (Product weekly, Architecture biweekly ou plénière mensuelle).',
  constitution: 'cela vivrait dans les instructions d\'agent (les non-négociables de l\'organisation) et dans les règles de l\'équipe, versionnées dans son dépôt.',
  specify: 'cela vivrait dans la Feature spec versionnée (registre Purpose), à laquelle le ticket Jira est rattaché : à la création du ticket, le TOM vérifie que la spec existe et cite ses contrats.',
  clarify: 'cela vivrait dans le Refinement (backlog grooming) de la feature team : les questions ouvertes s\'y règlent avant le Sprint Planning.',
  plan: 'cela vivrait dans la Solution Design Spec et les ADR ; un choix qui engage d\'autres équipes passe à l\'Architecture biweekly.',
  tasks: 'cela vivrait dans les user stories et stories techniques de Jira, chacune rattachée à la spec et à son task brief.',
  analyze: 'cela vivrait dans le contrôle de la Definition of Ready, avant le Sprint Planning : spec, plan et stories cohérents, sinon pas de build.',
  'spec-publish': 'cela vivrait dans le registre Purpose du Context Nexus de l\'équipe, avec ses épinglages : c\'est ce que l\'Assembler injecte aux agents.',
  'contract-v1': 'cela vivrait dans le registre Contracts du Context Nexus (schéma, exemples, mock), fusionné par merge request et consommé par les autres équipes à une version épinglée.',
  implement: 'cela vivrait dans Claude Code (AccorGPT) sur une branche GitLab, une merge request par incrément, avec le coût en tokens suivi par task brief dans Langfuse.',
  tests: 'cela vivrait dans les tests lancés par GitLab CI, et dans XRay pour la campagne de test du QA (Playwright pour le bout en bout).',
  'spec-learn': 'cela vivrait dans la même merge request que le code : la spec mise à jour fait partie de ce que le Develop remet au Deploy.',
  sign: 'cela vivrait dans l\'approbation nominative de la merge request par un humain authentifié, exigée en périmètre PCI et au CAB.',
  runbook: 'cela vivrait dans le registre Process (runbooks exécutables), à côté des procédures de déploiement et de l\'historique d\'incidents.',
  flag: 'cela vivrait dans l\'outil de feature flags de l\'équipe, chaque bascule tracée (qui, quand, quel périmètre). Selon le TOM, ce n\'est tracé nulle part aujourd\'hui : G4 ne peut pas encore s\'y appliquer.',
  cost: 'cela vivrait dans Langfuse (coût par task brief) et dans les tableaux FinOps de la passerelle accor.gpt (LiteLLM) ; ici, vous le relevez à la main.',
  'kpi-publish': 'cela vivrait dans les tableaux de bord KPI et les alertes (Splunk pour l\'observabilité), que les équipes Data et le PM lisent pour le verdict G5.',
  bonus: 'cela vivrait au Product weekly : le PM et les équipes Data y rendent le verdict de valeur (G5) ; un retrait repart dans le Discovery Backlog.',
  retour: 'cela vivrait dans le process backlog du TOM : les constats sur la façon de livrer y sont routés plutôt que perdus.',
  'retour-final': 'cela vivrait dans le process backlog du TOM : les constats sur la façon de livrer y sont routés plutôt que perdus.',
};

// Les quatre responsabilités du TOM jouées par la squad : personne ne les connaît, on les apprend en les exerçant.
// À chaque étape, ce que fait concrètement celle ou celui qui porte la responsabilité en jeu.
const HAT_DOES = {
  assemble: 'Ici : s\'assure que l\'agent travaille avec le contexte à jour, puis annonce à la squad ce qui a changé.',
  'own-changed': 'Ici : lit le changement à voix haute devant la squad et repère ce qu\'il touche dans votre spec, vos tests et votre code.',
  react: 'Ici : lit le changement à voix haute devant la squad, repère ce qu\'il touche chez vous, puis fait mettre à jour l\'épinglage.',
  'intent-copy': 'Ici : tient la plume de la Business Intent Spec, fait travailler l\'agent, puis porte les questions à la Direction Revenu Annexe.',
  'intent-fill': 'Ici : rapporte les réponses de la Direction Revenu Annexe et les décisions de la squad, et vérifie que chaque phrase a sa source.',
  'intent-sign': 'Ici : fait relire les 5 champs à la squad et signe comme owner. Le Decision Guarantor vérifie qu\'un humain nommé s\'engage.',
  publish: 'Ici : publie le travail de la squad dans le Nexus et vérifie que rien ne sort du dossier de la squad.',
  gate: 'Ici : lance le gate-check, présente le dossier au gate keeper et engage la squad sur le verdict.',
  constitution: 'Ici : vérifie que chaque principe de la constitution vient bien d\'une règle du Nexus, avec sa source.',
  specify: 'Ici : lance la spec et la relit. Elle doit reprendre la Business Intent Spec sans rien inventer.',
  clarify: 'Ici : chacun répond selon sa responsabilité ; le Specification Engineer consigne les réponses dans la spec.',
  plan: 'Ici : le Specification Engineer garde le quoi ; l\'Agentic Workflow Orchestrator choisit comment faire travailler l\'agent.',
  tasks: 'Ici : découpe le travail pour l\'agent en tâches vérifiables et surveille le budget de tokens.',
  analyze: 'Ici : lit le rapport de cohérence et tranche chaque incohérence. C\'est une décision, pas une formalité.',
  'spec-publish': 'Ici : publie la spec avec ses épinglages, pour que le Nexus puisse vous prévenir si un contrat change.',
  'contract-v1': 'Ici : écrit le contrat avec l\'agent ; la squad le relit, puis le signe en le passant en active.',
  implement: 'Ici : lance l\'agent tâche par tâche, vérifie que les tests passent et surveille les tokens.',
  tests: 'Ici : fait écrire un test par critère d\'acceptance et vérifie qu\'il porte le nom du critère.',
  sign: 'Ici : relit le code de débit et le signe de son nom. L\'agent ne le fait jamais.',
  runbook: 'Ici : s\'assure qu\'un owner d\'exploitation est nommé et que le retour arrière tient en une commande.',
  flag: 'Ici : décide d\'activer et l\'active lui-même ou elle-même, avec un motif écrit.',
  'kpi-publish': 'Ici : publie la définition des KPI que les autres squads et la mesure G5 utiliseront.',
  bonus: 'Ici : rend le verdict de valeur face à la promesse faite en G1.',
  nogo: 'Ici : fait corriger le critère nommé par le gate keeper, vérifie le gate-check, puis redemande la gate.',
  retour: 'Ici : chacun donne son avis, la squad répond d\'une seule voix.',
  'retour-final': 'Ici : chacun donne son avis, la squad répond d\'une seule voix.',
  'spec-learn': 'Ici : fait remonter dans la spec ce que le code a appris, et la republie.',
  cost: 'Ici : relève la consommation de l\'agent et la rapproche de ce qu\'elle a produit.',
};

// Les points de contrôle humains du TOM (gates par tâche) : Approuver, Valider, Choisir, Signer.
const CHECKPOINT = {
  'intent-copy': 'Approuver : l\'intention est-elle bien cadrée ?', 'intent-fill': 'Approuver : l\'intention est-elle bien cadrée ?', specify: 'Approuver : l\'intention est-elle bien cadrée ?',
  constitution: 'Valider : l\'analyse est-elle solide ?', clarify: 'Valider : l\'analyse est-elle solide ?', tasks: 'Valider : l\'analyse est-elle solide ?', analyze: 'Valider : l\'analyse est-elle solide ?',
  implement: 'Valider : le résultat est-il solide ?', tests: 'Valider : le résultat est-il solide ?', 'spec-learn': 'Valider : la spec dit-elle vrai ?', react: 'Valider : l\'analyse du changement est-elle solide ?', 'own-changed': 'Valider : l\'analyse du changement est-elle solide ?',
  plan: 'Choisir : quelle option, parmi celles que l\'agent propose ?',
  'intent-sign': 'Signer : la livraison est-elle acceptée ?', 'contract-v1': 'Signer : la livraison est-elle acceptée ?', gate: 'Signer : la livraison est-elle acceptée ?', nogo: 'Signer : la correction est-elle acceptée ?',
  sign: 'Signer : la livraison est-elle acceptée ?', flag: 'Signer : l\'activation est-elle décidée ?', runbook: 'Signer : l\'exploitation est-elle prête ?',
};
const HANDOVER = {
  G1: 'Votre Business Intent Spec devient l\'entrée du Design : la spec Spec Kit va la reprendre.',
  G2: 'Votre spec et votre contrat v1 deviennent l\'entrée du Develop : l\'agent code contre eux.',
  G3: 'Votre code, vos tests et votre spec à jour deviennent l\'entrée du Deploy.',
  G4: 'Votre service observé devient l\'entrée de Deepen : les KPI publiés serviront au verdict de valeur (G5).',
};

function hatDefinition(hat, config) {
  const hats = (config && config.hats) || {};
  const found = Object.keys(hats).filter(h => String(hat).includes(h) || (/Orchestrator|Guarantor/.test(h) && String(hat).includes(h.split(' ').pop())));
  return found.length ? found.map(h => `${h} : ${hats[h]}`).join(' ') : null;
}

// Ce que le participant apprend en faisant l'étape (une phrase), et le repère d'outil à lui donner à ce moment-là.
const SCREEN = 'l\'écran de votre squad (onglet à côté de l\'éditeur)';
const NEW_SESSION = 'ouvrez une nouvelle session Claude (bouton « Nouvelle session »)';
const LEARN = {
  assemble: ['Context Nexus : le brief assemblé est le contexte que lit l\'agent (règles, contrats des autres squads, versions). Sans lui, il invente. Manifesto du TOM : « le contexte n\'est jamais supposé ».',
    `Ensuite, ${NEW_SESSION} : l'agent repart du brief à jour.`],
  'own-changed': ['Épinglage : votre contrat est une promesse faite aux autres squads ; quand il change, votre spec, vos tests et votre code décrivent encore l\'ancienne version.',
    `Sur ${SCREEN}, votre contrat est en rouge et ses consommateurs en ambre. Une fois réaligné et republié, ${NEW_SESSION} pour repartir de la nouvelle version.`],
  react: ['Épinglage : vous aviez noté la version de chaque document que vous utilisez ; le Nexus voit qu\'elle a changé et vous prévient. C\'est ce qui évite de coder sur une version périmée.',
    `Sur ${SCREEN}, le document concerné est en ambre. Une fois réaligné et republié, ${NEW_SESSION} pour ne pas mélanger l'ancienne et la nouvelle version.`],
  'intent-copy': ['Discover : on définit le besoin et son succès chiffré avant toute solution. La Business Intent Spec rejoint le registre Purpose du Nexus : toutes les étapes suivantes s\'y réfèrent.',
    'Ouvrez le document depuis l\'explorateur de fichiers, à gauche : context-nexus › teams › votre squad › intent › business-intent.md. Chaque phrase porte l\'étiquette de sa source.'],
  'intent-fill': ['Discover : un chiffre sans source ne vaut rien en G1. Le Nexus donne les faits, la Direction Revenu Annexe son ambition, la squad son engagement.',
    'Allez voir votre animateur AI4D, qui joue la Direction Revenu Annexe, avec vos questions : elle ne répond qu\'à celles qu\'on lui pose.'],
  'intent-sign': ['TOM : cadrer l\'intention et fixer la priorité ne sont jamais délégués à l\'IA. Un humain nommé signe.',
    null],
  publish: ['Publier, c\'est rendre votre travail visible aux autres squads et au gate keeper. Manifesto du TOM : « ce qui n\'est pas écrit n\'existe pas ».',
    `Regardez ${SCREEN} : votre publication apparaît dans le flux et les critères de votre prochaine gate se cochent.`],
  gate: ['Une gate, c\'est un contrôle automatique puis une décision humaine. Le gate-check est « AI-executed » (une gate automatique tranche la forme) ; le gate keeper est « Human » (il juge le fond) ; vous, vous travaillez en « AI-assisted » : l\'IA produit, vous tenez le verdict. Manifesto : « une gate se passe sur preuve, jamais sur déclaration ».',
    `Quand le gate-check est vert, vous n'avez plus rien à faire : à l'heure de votre créneau, le gate keeper (une personne de l'animation) vient à votre table, écoute votre présentation, puis enregistre GO ou NO-GO sur son poste. Vous le verrez sur ${SCREEN} ; tapez alors /coach (fiche de retour, puis nouvelle session pour la phase suivante).`],
  constitution: ['SDD avec Spec Kit, étape 0 : la constitution fixe les principes que l\'agent ne pourra pas contourner. Ils viennent des règles du Nexus, pas de son imagination.', null],
  specify: ['Spec Kit « Intent » : la spec fonctionnelle dit le quoi et le pourquoi, à partir de votre Business Intent Spec. C\'est elle, et non un ticket, qui guidera le code.', null],
  clarify: ['Spec Kit « Clarify » : l\'agent liste ce que la spec laisse flou. Chaque réponse évite un bug plus tard.', 'Pour chaque question : la réponse est dans le Nexus, chez la Direction Revenu Annexe, chez vous, ou dans le contrat d\'une autre squad.'],
  plan: ['Spec Kit « Design » : le comment. C\'est ici qu\'on compare vos champs à ceux des contrats des autres squads (type, unité, format), avant qu\'un écart devienne un bug.', null],
  tasks: ['Spec Kit « Decompose » : des tâches courtes et testables, pour que le travail de l\'agent soit vérifiable une à une.', null],
  analyze: ['Spec Kit « Check » : spec, plan, tâches et constitution doivent raconter la même histoire avant qu\'on écrive du code.', null],
  'spec-publish': ['La spec publiée porte ses épinglages : si un contrat qu\'elle utilise change, le Nexus vous préviendra.', `Regardez ${SCREEN} : la spec apparaît dans le flux.`],
  'contract-v1': ['Registre Contracts : votre contrat v1 est une promesse faite aux autres squads. Publié tôt, même imparfait, il leur permet d\'avancer.', `Sur ${SCREEN}, votre contrat passe en v1 et les squads qui le lisent devront s'y épingler.`],
  implement: ['Spec Kit « Implement » : l\'agent code tâche par tâche contre la spec, avec un test nommé par critère d\'acceptance.', `Si ${SCREEN} passe au rouge pendant ce temps, arrêtez-vous : un contrat a changé.`],
  tests: ['Un critère d\'acceptance sans test n\'est qu\'une intention (ENG-04).', null],
  sign: ['TOM : certaines décisions ne sont jamais déléguées à l\'IA ; la signature du code de débit (PCI) en fait partie.', null],
  runbook: ['Deploy, Runtime Spec : comment exploiter le service et revenir en arrière. Sans runbook, on ne sait pas défaire.', null],
  flag: ['Release ≠ Activation : déployer et activer sont deux décisions. La seconde est humaine et tracée (qui, quand, pourquoi).', null],
  'kpi-publish': ['Les KPI publiés permettront, en Deepen (G5), de juger la valeur réelle face à la promesse de G1.', `Regardez ${SCREEN} : la publication apparaît dans le flux.`],
  nogo: ['Convention du TOM : une gate renvoie, elle ne bloque pas en silence. Le no-go nomme le critère qui manque ; c\'est un apprentissage, pas une sanction.',
    `Sur ${SCREEN}, la gate est rouge avec son motif. Une fois corrigé et publié, prévenez le gate keeper pour repasser.`],
  retour: ['Le TOM évolue avec le terrain : vos retours de squad alimentent son learning report (lecture par squad, jamais par personne).', null],
  'retour-final': ['Le TOM est une cible en cours de validation : vos retours de fin de session décident des ajustements des hackathons de 8 h.', null],
  'spec-learn': ['Le TOM attend du Develop une spec mise à jour de ce que le code a appris (écarts, composants inventés) : la spec reste la vérité, pas le code seul.', null],
  cost: ['AI FinOps : le coût IA est attribué à l\'incrément (G4) et lu avec la qualité. Règle du TOM : jamais un gain de vitesse sans sa mesure de qualité.', null],
  bonus: ['Deepen et Drop : le PDLC ne s\'arrête pas au déploiement ; on juge la valeur réelle et on retire l\'ancien processus.', null],
};

// Qui rend le verdict de chaque gate dans le TOM V1.0 (le gate keeper du hackathon joue cette fonction).
export const ACCOUNTABLE = {
  G1: 'le Product Manager',
  G2: 'le PO, l\'UX, le Tech Lead et l\'architecte',
  G3: 'les développeurs et la QA (avec le CAB en périmètre PCI)',
  G4: 'la QA et les équipes d\'exploitation (POE)',
};

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
    return S('react', n.path.startsWith('teams/') ? 'Réagir : un contrat d\'une autre squad a changé' : 'Réagir : un document du Nexus que vous utilisez a changé', 'Context Engineer',
      `git -C ${NX} pull && node ${NX}/tools/context-assemble.mjs --squad ${squad} --mark-stale --out .context/brief.md && git -C ${NX} log -p -3 -- teams/`,
      'Lire CE qui a changé, pas seulement QUE ça a changé : c\'est ce qui évite de coder sur un contrat périmé (règle n°7 de Vélora).',
      ['Le diff du contrat est lu à voix haute devant la squad', 'La squad a identifié les exigences, critères et tâches touchés', 'Le contrat d\'une autre squad est épinglé à sa nouvelle version, puis la spec repasse en active'],
      { followUp: `/speckit-clarify Le contrat ${n.path} est passé de la version ${n.pinned} à ${n.current} (voir .context/brief.md). Quelles exigences, quels critères d'acceptance et quelles tâches de notre spec sont impactés ?`, items: pinIssues.map(x => `${x.path} ${x.pinned} → ${x.current} (${x.kind})`) });
  }

  // Fin de session : la fiche de retour finale, avant tout le reste.
  if (c.block === 'Débrief' && !c.retours.some(r => r[1] === 'FIN')) {
    return S('retour-final', 'Fiche de retour de fin de session (2 minutes)', 'toute la squad',
      `node ${NX}/tools/retour.mjs FIN --rythme <oui|en-partie|non> --cadrage … --gates … --criteres … --responsabilites … --contexte … --8h … --changer "…" --garder "…" --terrain "…"`,
      'Le TOM est une cible en cours de validation : vos retours de squad, lus par l\'owner du TOM, le font évoluer, et préparent les hackathons de 8 h.',
      ['Répondre en squad, d\'une seule voix', 'Les trois lignes libres sont facultatives', '« Pas comme chez nous » : l\'outil, le rituel ou le geste qui ne ressemble pas à votre quotidien chez Accor']);
  }

  // Après chaque verdict : la fiche de retour (20 secondes), puis le passage à la suite.
  // Une fiche par verdict : après un NO-GO puis un GO, la seconde fiche porte aussi le passage à la phase suivante.
  const fb = Object.keys(gates).find(g => gates[g].verdict && !c.retours.some(r => r[1] === g && r[2] === gates[g].verdict.verdict));
  if (fb) {
    const v = gates[fb].verdict;
    return S('retour', `Fiche de retour ${fb} (20 secondes)`, 'toute la squad',
      `node ${NX}/tools/retour.mjs ${fb} --clarte <claire|partielle|floue> --flou "<le critère flou, si besoin>"`,
      `Le gate keeper a rendu son verdict : ${v.verdict}${v.note ? ` (${v.note})` : ''}. Avant de continuer, dites si les critères de ${fb} étaient clairs : c'est ce qui fait évoluer le TOM.`,
      ['Une seule réponse pour la squad', 'Lecture par squad, jamais par personne'], { gate: fb, verdict: v.verdict });
  }

  if (!nextGate) {
    return S('bonus', 'Deepen et Drop (bonus)', 'Decision Guarantor', '', 'Les quatre gates sont passées : place au verdict G5 sur 30 jours de télémétrie et au retrait de l\'ancien processus (G6), en version courte ou à l\'oral.',
      ['Le verdict est mesuré face au critère chiffré de G1']);
  }

  const gateReady = gates[nextGate].autoOk === gates[nextGate].autoTotal;
  // Un NO-GO renvoie, il ne bloque pas en silence : il nomme le critère qui manque.
  const lastV = gates[nextGate].verdict;
  if (lastV && lastV.verdict === 'NO-GO') {
    return S('nogo', `NO-GO à ${nextGate} : corriger, puis repasser`, 'Decision Guarantor',
      `npm run gate-check -- ${nextGate}`,
      `Le gate keeper ${gates[nextGate].keeper} a dit NO-GO${lastV.note ? ` : « ${lastV.note} »` : ''}. Le no-go nomme ce qui manque et vous renvoie à l'étape concernée : corrigez ce point, puis redemandez la gate.`,
      ['Le critère nommé par le gate keeper est corrigé, et la correction est publiée', 'Le gate-check est vert avant de redemander la gate'], { note: lastV.note });
  }
  const GATE = () => S('gate', `Passer ${nextGate} · ${gates[nextGate].name}`, 'Decision Guarantor', `npm run gate-check -- ${nextGate}`,
    `Lancez le gate-check officiel. S'il est au vert, le gate keeper ${gates[nextGate].keeper} vient à votre table à ${gates[nextGate].slot} : votre Decision Guarantor lui présente le livrable en deux minutes. Aujourd'hui, ce gate keeper de l'animation joue ${ACCOUNTABLE[nextGate] || 'la fonction nommée par le TOM'} : chez Accor, c'est ${ACCOUNTABLE[nextGate] ? 'cette fonction' : 'elle'} qui rend ce verdict. Il juge ce qu'une machine ne peut pas juger, et enregistre lui-même son verdict.`,
    gates[nextGate].human, { slot: gates[nextGate].slot });

  if (nextGate === 'G1') {
    if (!c.intentText) return S('intent-copy', 'Business Intent Spec : la rédiger avec Claude', 'Specification Engineer',
      `cp ${NX}/gabarits/business-intent.md ${NX}/teams/${squad}/intent/business-intent.md`,
      'Un besoin écrit en 5 champs oblige à choisir : problème, utilisateurs, succès chiffré, données, priorité. Trois sources, chacune visible dans le document par une étiquette : le Context Nexus pour les faits, les règles et les décisions déjà prises (Claude les lit et les cite) ; la Direction Revenu Annexe pour son ambition chiffrée, l\'horizon et la priorité (votre animateur AI4D la joue : allez la voir) ; votre squad pour ce qu\'elle choisit et signe.',
      ['Chaque phrase porte son étiquette : [Nexus : fichier], [Direction Revenu Annexe], [Décision de la squad] ou [À confirmer]', 'Rien de ce qui est dans le Nexus n\'est renvoyé à la Direction Revenu Annexe', 'Aucun chiffre sans source']);
    if (c.filled.length < 5 || PLACEHOLDER.test(c.intentText.replace(/^---\n[\s\S]*?\n---\n?/, ''))) return S('intent-fill', 'Business Intent Spec : remplir les 5 champs', 'Specification Engineer',
      'Complète la Business Intent Spec. Cherche d\'abord dans le Context Nexus (brief, règles métier RM-xx, decisions-deja-prises.md, contrats des squads) et cite chaque fichier. Ne renvoie à la Direction Revenu Annexe que son ambition chiffrée, l\'horizon et la priorité ; à la squad, son seuil engagé, l\'owner et ce qu\'elle ne fait pas. Ce que personne n\'a : « à confirmer », jamais inventé.',
      'Le brief est volontairement flou : c\'est en allant poser les questions à la Direction Revenu Annexe (jouée par votre animateur AI4D) que la squad obtient ses chiffres. L\'agent prépare les questions, la squad décide : l\'Intent reste humain.',
      ['Le critère de succès est chiffré (valeur, seuil, horizon) et son auteur est connu', 'Chaque affirmation est datée et sourcée', 'Ce que le brief ne dit pas est marqué « à confirmer », pas inventé'],
      { items: c.filled.length < 5 ? [`${c.filled.length} champ(s) sur 5 remplis`] : ['Il reste du texte du gabarit entre < >'] });
    if (!c.ownerOk || c.intentFm.meta.status !== 'active') return S('intent-sign', 'Business Intent Spec : relire et signer', 'Specification Engineer',
      `Sur la phrase de signature d'un humain nommé : dans l'en-tête, owner: <prénom.nom>, status: active, last-validated: ${c.config.date}`,
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
      '/speckit-implement', `Une tâche, un test, un commit : il reste ${st.tasksTodo} tâche(s). Si un contrat d'une autre squad change, votre animateur AI4D l'annoncera, et /coach comme ce tableau le signaleront.`,
      ['Chaque critère d\'acceptance a un test nommé qui le référence (ENG-04)', 'Les tests sont verts avant chaque commit'], { remaining: st.tasksTodo });
    if (st && st.testFiles === 0) return S('tests', 'Des tests nommés d\'après vos critères', 'Agentic Workflow Orchestrator',
      'Écris un test par critère d\'acceptance de la spec, nommé d\'après lui, puis lance npm test.',
      'Un critère sans test n\'est qu\'une intention (ENG-04).', ['Chaque test cite le critère qu\'il couvre']);
    if (st && st.testFiles > 0 && !st.marks.learned) return S('spec-learn', 'La spec apprend de l\'implémentation', 'Specification Engineer',
      'Compare notre code à la spec : liste les écarts et les composants inventés ou adaptés, mets à jour la spec en conséquence (nouvelle version), puis dis-nous ce qui a changé.',
      'Le TOM attend du Develop une spec à jour de ce que le code a appris : sinon, la spec ment et la prochaine équipe repart d\'une fausse description. Dites ensuite « spec à jour » à /coach.',
      ['Chaque écart est soit corrigé dans le code, soit assumé dans la spec', 'La spec mise à jour est republiée']);
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
    const costTxt = ((c.runbookText.split('## Coût IA')[1] || '').split(/\n## /)[0] || '').trim();
    if (!costTxt || costTxt.startsWith('<')) return S('cost', 'Relever le coût IA de l\'incrément', 'Agentic Workflow Orchestrator',
      'Ajoute à la section « Coût IA » de notre runbook la consommation que je te donne, et ce qu\'elle a produit (tests verts, gates passées)',
      'Le TOM attribue le coût IA à chaque incrément (G4) et le lit avec la qualité : un gain de vitesse sans sa qualité ni son coût ne prouve rien.',
      ['Le chiffre vient de l\'affichage de Claude, pas d\'une estimation', 'Il est rapproché de la qualité obtenue']);
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
  const ph = PHASES[s.phase];
  L.push(`PHASE : ${s.phase}${ph ? ` (phase ${ph.n} sur 4 du PDLC) · objectif : ${ph.goal} · on en sort avec ${ph.output}` : ''}${s.nextGate ? ` · prochaine gate ${s.nextGate} « ${s.gates[s.nextGate].name} » à ${s.gates[s.nextGate].slot}` : ''}`);
  L.push('');
  const st = s.step;
  L.push(`PROCHAINE ÉTAPE : ${st.label}`);
  L.push(`  RESPONSABILITÉ EN JEU : ${st.hat}${st.hatDef ? ` (${st.hatDef})` : ''}${st.hatDoes ? ` · ${st.hatDoes}` : ''}`);
  if (st.learn) L.push(`  CE QUE VOUS APPRENEZ : ${st.learn}`);
  if (st.say) L.push(`  À TAPER DANS CLAUDE :\n${st.say.split('\n').map(l => '    ' + l).join('\n')}`);
  if (st.humanDo) L.push(`  GESTE HUMAIN (l'agent ne le fait pas) : ${st.humanDo}`);
  if (st.cue) L.push(`  REPÈRE OUTIL : ${st.cue}`);
  if (st.accor) L.push(`  SUR LE TERRAIN : ${st.accor}`);
  if (st.files && st.files.length) L.push('  FICHIERS DE L\'ÉTAPE (explorateur de fichiers, à gauche) :\n' + st.files.map(f => `    - ${f.label} : ${f.path}${f.exists === false ? ' (pas encore créé)' : ''}`).join('\n'));
  if (st.command && st.command !== st.say) L.push(`  (Ce que Claude lancera : ${st.command.split('\n')[0]})`);
  if (st.followUp) L.push(`  Ensuite :\n    ${st.followUp}`);
  if (st.items && st.items.length) L.push('  Points à regarder :\n' + st.items.map(i => `    - ${i}`).join('\n'));
  L.push(`  Pourquoi : ${st.why}`);
  if (st.checkpoint) L.push(`  POINT DE CONTRÔLE HUMAIN : ${st.checkpoint}`);
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
    L.push('LE HACKATHON : Vélora Hôtels (fictif) veut vendre le late check-out en ligne. Quatre squads construisent chacune un volet ; aucune ne peut finir seule :');
    for (const [id, q] of Object.entries(config.squads)) L.push(`  ${q.number} · ${q.label}${id === s.squad ? ' (vous)' : ''} : ${q.volet}`);
    // Chaque contrat avec son chemin dans l'explorateur : la squad doit pouvoir aller l'ouvrir.
    const short = p => p.split('/').pop().replace(/\.md$/, '');
    const whose = p => { const q = Object.entries(config.squads).find(([id]) => p.startsWith(`teams/${id}/`)); return q ? `squad ${q[1].label}` : p.startsWith('org/') ? 'règles de l\'organisation' : /\/knowledge\//.test(p) ? 'connaissance du programme' : 'contrat du programme'; };
    const pub = s.own.contracts || [];
    const reads = [...new Map(s.neighbors.filter(n => !n.mine).map(n => [n.path, n])).values()];
    if (pub.length) {
      L.push('VOTRE SQUAD PUBLIE :');
      for (const c of pub) L.push(`  ${short(c.path)} (v${c.version}) : ${NEXUS_SHOWN}/${c.path}`);
      L.push('ELLE LIT :');
      for (const n of reads) L.push(`  ${short(n.path)} (${whose(n.path)}) : ${NEXUS_SHOWN}/${n.path}`);
    }
    L.push('');
    L.push('OÙ SONT LES FICHIERS (explorateur de fichiers, à gauche ; le Context Nexus y est le dossier context-nexus/) :');
    for (const [what, where] of s.fileMap) L.push(`  ${what} : ${where}`);
    L.push('');
    L.push('LE PDLC : quatre phases (Discover, Design, Develop, Deploy), chacune close par une gate : un contrôle automatique, puis une décision humaine (le gate keeper).');
    L.push('');
    L.push('RESPONSABILITÉS À RÉPARTIR (TOM : pas de nouveaux postes, des responsabilités portées par vos profils ; la squad se met d\'accord à l\'oral, maintenant ; à six, deux responsabilités sont portées à deux) :');
    for (const [h, d] of Object.entries(config.hats)) L.push(`  ${h} : ${d}`);
    L.push('');
    L.push('JOURNÉE DE VOTRE SQUAD (horaire · phase · ce qu\'on en sort · gate) :');
    for (const b of s.agenda.filter(b => ['Discover', 'Design', 'Pause', 'Develop', 'Deploy', 'Bonus'].includes(b.id))) {
      const ph = PHASES[b.id];
      const g = Object.values(s.gates).find(x => x.phase === b.id);
      L.push(`  ${b.from}-${b.to} · ${ph ? `${ph.n}. ${b.id} (${ph.goal.charAt(0).toLowerCase() + ph.goal.slice(1)}) · ${ph.output}` : b.id}${g ? ` · gate ${g.id} « ${g.name} » à ${g.slot}` : ''}`);
    }
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
