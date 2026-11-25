#!/usr/bin/env node
// Prend les captures brutes de l'Apple Watch (raw/watch/<langue>/1.png … 3.png) sur le simulateur démarré.
//
//   node capture/capture-watch.mjs                 21 langues
//   node capture/capture-watch.mjs --lang fr,de    certaines langues
//
// Prérequis : voir docs/capture-watch.md (paire iPhone + montre démarrée, Kelec installé et synchronisé, fenêtre
// Device Hub de la montre visible, permission Accessibilité pour le terminal).
// Par langue : langue de la montre + redémarrage, 1.png (page voiture), 2.png (carte), 3.png (confort thermique).
// Les écrans 2 et 3 s'ouvrent par des touches simulées dans la fenêtre (capture/watch-tap.swift).
// « Confirmer » n'est jamais touché : aucune commande n'est envoyée à la voiture.

import { existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { LANGS } from '../config.mjs';
import { HERE, LOCALES, mapColorRatio, parseArgs, run, sleep } from './common.mjs';

const BUNDLE = 'com.kelyanselme.MyRenault.watchkitapp';
const RAW = resolve(HERE, '../raw/watch');
const TAP = join(HERE, '.bin/watch-tap');
// Positions dans la capture de la montre (422×514).
const BTN = { hvac: [76, 412], map: [340, 412], close: [70, 76] };
const MAP_MIN_RATIO = 0.03;

const simctl = (...a) => run('xcrun', ['simctl', ...a]);

if (!existsSync(TAP)) {
  mkdirSync(join(HERE, '.bin'), { recursive: true });
  run('swiftc', [join(HERE, 'watch-tap.swift'), '-o', TAP], { stdio: 'inherit' });
}
const tap = ([x, y]) => {
  run('osascript', ['-e', 'tell application "Device Hub" to activate']); // sinon le premier clic ne sert qu'à donner le focus
  sleep(0.5);
  run(TAP, [String(x), String(y)]);
};

function bootedWatch() {
  const { devices } = JSON.parse(simctl('list', 'devices', 'booted', '-j'));
  const w = Object.values(devices).flat().filter((d) => /Watch/.test(d.name));
  if (w.length !== 1) throw new Error(`Il faut exactement une montre démarrée (trouvées : ${w.length})`);
  return w[0];
}

function setLanguage(udid, lang) {
  const [appleLang, locale] = LOCALES[lang];
  simctl('spawn', udid, 'defaults', 'write', '-g', 'AppleLanguages', '-array', appleLang);
  simctl('spawn', udid, 'defaults', 'write', '-g', 'AppleLocale', '-string', locale);
  simctl('shutdown', udid);
  simctl('boot', udid);
  simctl('bootstatus', udid, '-b');
  sleep(8);
}

const { langs } = parseArgs(LANGS);
const watch = bootedWatch();
console.log(`Montre : ${watch.name} (${watch.udid})`);
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
const failed = [];
const shot = (out, n) => simctl('io', watch.udid, 'screenshot', join(out, `${n}.png`));

for (const lang of langs) {
  if (!LOCALES[lang]) throw new Error(`Langue inconnue : ${lang}`);
  const out = join(RAW, lang);
  mkdirSync(out, { recursive: true });
  console.log(`\n== ${lang}`);

  setLanguage(watch.udid, lang);
  try { simctl('terminate', watch.udid, BUNDLE); } catch { /* pas lancée */ }
  simctl('launch', watch.udid, BUNDLE);
  sleep(6);
  shot(out, 1);

  let mapOk = false;
  for (let attempt = 1; attempt <= 3 && !mapOk; attempt++) {
    tap(BTN.map);
    sleep(8); // tuiles de la carte
    shot(out, 2);
    mapOk = (await mapColorRatio(page, join(out, '2.png'))) >= MAP_MIN_RATIO;
    if (!mapOk) console.log(`  carte vide, essai ${attempt}/3`);
    tap(BTN.close);
    sleep(2);
  }
  if (!mapOk) failed.push(lang);

  tap(BTN.hvac);
  sleep(3);
  shot(out, 3);
  tap(BTN.close);
  sleep(2);
}

await browser.close();
if (failed.length) console.log(`\n! Carte vide pour : ${failed.join(', ')}. Relancer avec --lang ${failed.join(',')}`);
console.log(`\nCaptures dans ${RAW}. Visuels : node generate.mjs --target ios-watch-ultra`);
