#!/usr/bin/env node
// Garde-fous du hackathon (hook PreToolUse de Claude Code). Il rend visibles les règles du jeu :
//   1. un agent ne bascule jamais un feature flag (Release ≠ Activation, règle Vélora n°3) ;
//   2. on n'écrit dans le Context Nexus que dans teams/<sa-squad>/ (règle du jeu n°2) ;
//   3. .context/brief.md est généré : on ne l'édite pas à la main.
// Code de sortie 2 = l'action est bloquée et le message (stderr) est montré à l'agent.
// Toute erreur interne laisse passer l'action : un garde-fou ne doit jamais bloquer le travail par accident.

import { readFileSync, existsSync, realpathSync, appendFileSync, mkdirSync } from 'node:fs';
import { resolve, join, dirname, basename, sep } from 'node:path';

function safe(fn, fallback) { try { return fn(); } catch { return fallback; } }

const input = safe(() => JSON.parse(readFileSync(0, 'utf8')), {});
const project = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
const tool = input.tool_name || '';
const ti = input.tool_input || {};

const squad = safe(() => readFileSync(join(project, '.hackathon', 'squad'), 'utf8').trim(), null)
  || (basename(project).startsWith('starter-') ? basename(project).replace(/^starter-/, '') : null);

function nexusDirs() {
  return [join(project, '..', 'context-nexus'), join(project, 'context-nexus')]
    .filter(d => existsSync(join(d, 'teams')))
    .map(d => safe(() => realpathSync(d), resolve(d)));
}

function realPathOf(p) {
  const abs = resolve(project, p);
  // Le fichier peut ne pas exister encore : on résout le dossier existant le plus proche.
  let dir = abs; const tail = [];
  while (!existsSync(dir) && dirname(dir) !== dir) { tail.unshift(basename(dir)); dir = dirname(dir); }
  return join(safe(() => realpathSync(dir), dir), ...tail);
}

function block(rule, message) {
  safe(() => {
    mkdirSync(join(project, '.hackathon'), { recursive: true });
    appendFileSync(join(project, '.hackathon', 'guard.log'), JSON.stringify({ at: new Date().toISOString(), rule, tool }) + '\n');
  });
  process.stderr.write(message + '\n');
  process.exit(2);
}


// Cibles d'écriture d'une commande Bash : redirections (> >>), tee, cp/mv/install/ln (dernier argument),
// rm/touch/mkdir/truncate (tous les arguments), sed -i / perl -i. Analyse volontairement simple : elle attrape
// les écritures courantes d'un agent, pas un script obscur. En cas de doute, elle laisse passer.
function splitShell(str) {
  const out = []; let cur = ''; let q = null;
  for (const ch of str) {
    if (q) { if (ch === q) q = null; else cur += ch; }
    else if (ch === '"' || ch === "'") q = ch;
    else if (/\s/.test(ch)) { if (cur) out.push(cur); cur = ''; }
    else cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}
function bashWriteTargets(command) {
  const targets = [];
  for (const seg of command.split(/\n|&&|\|\||;|\|/)) {
    const t = splitShell(seg.trim());
    if (!t.length) continue;
    for (let i = 0; i < t.length; i++) {
      const m = t[i].match(/^(?:\d|&)?>>?(.*)$/);
      if (m) { const dest = m[1] || t[i + 1]; if (dest && !dest.startsWith('&') && dest !== '/dev/null') targets.push(dest); }
    }
    const words = t.filter(x => !/^(?:\d|&)?>>?/.test(x));
    let i = 0; while (i < words.length && (words[i] === 'sudo' || /^\w+=/.test(words[i]))) i++;
    const verb = words[i]; const args = words.slice(i + 1).filter(a => !a.startsWith('-'));
    if (['tee'].includes(verb)) targets.push(...args);
    else if (['cp', 'mv', 'install', 'ln'].includes(verb) && args.length >= 2) targets.push(args[args.length - 1]);
    else if (['rm', 'rmdir', 'touch', 'mkdir', 'truncate'].includes(verb)) targets.push(...args);
    else if (['sed', 'perl'].includes(verb) && words.some(a => /^-\w*i/.test(a))) targets.push(...args.slice(1));
  }
  return targets;
}
function checkWriteTarget(file, via) {
  const real = realPathOf(file.replace(/^~(?=\/|$)/, process.env.HOME || '~'));
  for (const nx of nexusDirs()) {
    if (real === nx || real.startsWith(nx + sep)) {
      const allowed = squad ? join(nx, 'teams', squad) + sep : null;
      if (!allowed || !(real + sep).startsWith(allowed)) {
        block('nexus-write', `Le Context Nexus est partagé : vous n'écrivez que dans teams/${squad || '<votre-squad>'}/ (règle du jeu n°2)${via ? ` : ${via} touche ${file}` : ''}. ` +
          'Pour un désaccord avec une autre squad : allez la voir ; si vous ne vous entendez pas, le gate keeper tech tranche (Convergence Arbitrator).');
      }
    }
  }
  if (real === join(safe(() => realpathSync(project), project), '.context', 'brief.md')) {
    block('brief', 'Ce fichier est généré par le Context Assembler : ne l\'éditez pas. Relancez npm run context pour le régénérer depuis le Nexus.');
  }
}

// 1. Bascule de flag
if (tool === 'Bash' && typeof ti.command === 'string') {
  const cmd = ti.command;
  if (/\bnpm\b(?:\s+-\S+)*\s+(?:run|run-script|rum|urn)\s+(?:--\s+)?flag(?:\s|$)/.test(cmd)) {
    block('flag', 'Bascule de flag : action réservée à un humain (règle Vélora n°3, TOM : « Release ≠ Activation »). ' +
      'Dites à la squad que le Decision Guarantor doit la lancer lui-même : npm run flag -- <nom> on --reason "…". ' +
      'La ligne du journal (qui, quand, pourquoi) est la preuve demandée à la gate G4.');
  }
  // 2 ter. Écriture par commande Bash dans le Nexus (hors teams/<squad>/) ou dans le brief généré
  for (const target of bashWriteTargets(cmd)) checkWriteTarget(target, 'la commande');
  // 2 bis. Publication dans le Nexus : seulement teams/<squad>/
  const m = cmd.match(/git\s+-C\s+\S*context-nexus\s+add\s+(.+?)(?:&&|;|\|\||$)/);
  if (m && squad) {
    const target = m[1].trim().replace(/^["']|["']$/g, '');
    if (!target.startsWith(`teams/${squad}`)) {
      block('nexus-add', `Publication refusée : vous ne publiez que dans teams/${squad}/ (règle du jeu n°2). ` +
        `Utilisez : git -C ../context-nexus add teams/${squad}. Un désaccord avec le contrat d'une autre squad se règle en allant la voir.`);
    }
  }
}

// 2. Écriture dans le Nexus hors du dossier de la squad, et fichiers protégés
if (['Edit', 'Write', 'MultiEdit', 'NotebookEdit'].includes(tool)) {
  const file = ti.file_path || ti.notebook_path;
  if (file) {
    const real = realPathOf(file);
    for (const nx of nexusDirs()) {
      if (real === nx || real.startsWith(nx + sep)) {
        const allowed = squad ? join(nx, 'teams', squad) + sep : null;
        if (!allowed || !(real + sep).startsWith(allowed)) {
          block('nexus-write', `Le Context Nexus est partagé : vous n'écrivez que dans teams/${squad || '<votre-squad>'}/ (règle du jeu n°2). ` +
            'Pour un désaccord avec une autre squad : allez la voir ; si vous ne vous entendez pas, le gate keeper tech tranche (Convergence Arbitrator).');
        }
      }
    }
    if (real === join(safe(() => realpathSync(project), project), '.context', 'brief.md')) {
      block('brief', 'Ce fichier est généré par le Context Assembler : ne l\'éditez pas. Relancez npm run context pour le régénérer depuis le Nexus.');
    }
    if (basename(real) === 'flags.json') {
      const newText = [ti.new_string, ti.content, ...(Array.isArray(ti.edits) ? ti.edits.map(e => e.new_string) : [])].filter(Boolean).join('\n');
      if (/\btrue\b/.test(newText)) {
        block('flags-json', 'Activer un flag à la main contourne le journal des flags : action réservée à un humain, via npm run flag -- <nom> on --reason "…" (règle Vélora n°3).');
      }
    }
  }
}
process.exit(0);
