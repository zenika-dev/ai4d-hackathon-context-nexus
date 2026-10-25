#!/usr/bin/env node
// ecran-squad · l'écran de la squad, dans son Codespace ou sur son poste : l'écran commun en lecture seule,
// plus un panneau « Votre squad » (prochaine étape, phrase à dire à Claude, critères de la gate).
// Lancé en arrière-plan par le hook de début de session de Claude ; sans effet s'il tourne déjà.
//
//   node ../context-nexus/tools/ecran-squad.mjs             # depuis le dossier du starter → http://localhost:4000
//
// L'écran lit une copie à part du Nexus (~/.hackathon/ecran-nexus), qu'il met à jour toutes les 15 s : il ne touche
// jamais au clone de travail de la squad (aucun git pull pendant qu'elle écrit).

import { existsSync, mkdirSync, openSync, readFileSync, realpathSync } from 'node:fs';
import { join, resolve, basename, dirname } from 'node:path';
import { homedir } from 'node:os';
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import http from 'node:http';

const opt = k => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : null);
const PORT = Number(opt('--port') || 4000);
const tools = dirname(realpathSync(fileURLToPath(import.meta.url)));
const local = resolve(tools, '..');
const starter = resolve(opt('--starter') || process.cwd());
const squad = (() => {
  try { return readFileSync(join(starter, '.hackathon', 'squad'), 'utf8').trim(); } catch { /* déduite du nom */ }
  return basename(starter).replace(/^starter-/, '');
})();

const running = () => new Promise(ok => {
  const req = http.get({ host: '127.0.0.1', port: PORT, path: '/health', timeout: 800 }, res => { res.resume(); ok(res.statusCode === 200); });
  req.on('error', () => ok(false));
  req.on('timeout', () => { req.destroy(); ok(false); });
});

if (await running()) process.exit(0);

const home = join(homedir(), '.hackathon');
mkdirSync(home, { recursive: true });
const mirror = join(home, 'ecran-nexus');
let nexus = mirror;
try {
  if (!existsSync(join(mirror, '.git'))) {
    const url = execFileSync('git', ['-C', local, 'remote', 'get-url', 'origin'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    execFileSync('git', ['clone', '--quiet', url, mirror], { stdio: 'ignore', timeout: 60000 });
  }
} catch {
  nexus = local;   // pas de réseau ou pas d'accès : l'écran lit le clone de travail, sans le mettre à jour
}

const log = openSync(join(home, 'ecran.log'), 'a');
const args = [join(tools, 'nexus-board.mjs'), '--nexus', nexus, '--port', String(PORT), '--squad', squad, '--starter', starter, '--local', local];
if (nexus === mirror) args.push('--pull', '15');
spawn(process.execPath, args, { detached: true, stdio: ['ignore', log, log] }).unref();
console.log(`Écran de la squad : http://localhost:${PORT}`);
