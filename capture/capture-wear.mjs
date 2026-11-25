#!/usr/bin/env node
// Prend les captures brutes Wear OS (raw/wear/<langue>/1.png … 3.png) sur l'émulateur de montre démarré.
//
//   node capture/capture-wear.mjs                 21 langues
//   node capture/capture-wear.mjs --lang fr,de    certaines langues
//   node capture/capture-wear.mjs --serial emulator-5556
//
// Prérequis : voir docs/capture-wear.md (émulateur Wear OS démarré, app `:wear` installée en release, compte
// synchronisé depuis le téléphone). Pas de Maestro ni de clics : `adb input tap` suffit sur la montre.
// Par langue : langue du système + app relancée, 1.png (page voiture), 2.png (carte), 3.png (confort thermique).
// Le bouton de confirmation n'est jamais touché : aucune commande n'est envoyée à la voiture.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { LANGS } from '../config.mjs';
import { HERE, LOCALES, mapColorRatio, parseArgs, run, sleep } from './common.mjs';

const PKG = 'com.myrenaultplus';
const ACTIVITY = `${PKG}/com.kelec.wear.MainActivity`;
const RAW = resolve(HERE, '../raw/wear');
// Positions des boutons de la page voiture (écran 480×480).
const BTN = { hvac: [114, 338], map: [366, 338] };
const MAP_MIN_RATIO = 0.03;

const { langs, value } = parseArgs(LANGS);
const serial = value('--serial') ?? findWatch();
const adb = (...a) => run('adb', ['-s', serial, ...a]);
const tap = ([x, y]) => adb('shell', 'input', 'tap', String(x), String(y));

function findWatch() {
  const serials = run('adb', ['devices']).split('\n').slice(1).filter((l) => l.endsWith('\tdevice')).map((l) => l.split('\t')[0]);
  const watches = serials.filter((s) => run('adb', ['-s', s, 'shell', 'getprop', 'ro.build.characteristics']).includes('watch'));
  if (watches.length !== 1) throw new Error(`Il faut exactement une montre Wear OS (trouvées : ${watches.length}), sinon --serial`);
  return watches[0];
}

function screenshot(path) {
  writeFileSync(path, run('adb', ['-s', serial, 'exec-out', 'screencap', '-p'], { encoding: 'buffer', maxBuffer: 1 << 26 }));
}

console.log(`Montre : ${serial}`);
const initialLocale = adb('shell', 'cmd', 'locale', 'get-device-locale').trim();
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
const failed = [];

for (const lang of langs) {
  if (!LOCALES[lang]) throw new Error(`Langue inconnue : ${lang}`);
  const out = join(RAW, lang);
  mkdirSync(out, { recursive: true });
  console.log(`\n== ${lang}`);

  adb('shell', 'cmd', 'locale', 'set-device-locale', LOCALES[lang][1].replace('_', '-'));
  adb('shell', 'am', 'force-stop', PKG);
  adb('shell', 'am', 'start', '-n', ACTIVITY);
  sleep(7);
  screenshot(join(out, '1.png'));

  let mapOk = false;
  for (let attempt = 1; attempt <= 3 && !mapOk; attempt++) {
    tap(BTN.map);
    sleep(8); // tuiles de la carte
    screenshot(join(out, '2.png'));
    mapOk = (await mapColorRatio(page, join(out, '2.png'))) >= MAP_MIN_RATIO;
    if (!mapOk) console.log(`  carte vide, essai ${attempt}/3`);
    adb('shell', 'input', 'keyevent', 'BACK');
    sleep(2);
  }
  if (!mapOk) failed.push(lang);

  tap(BTN.hvac);
  sleep(3);
  screenshot(join(out, '3.png'));
  adb('shell', 'input', 'keyevent', 'BACK');
  sleep(1);
}

await browser.close();
adb('shell', 'cmd', 'locale', 'set-device-locale', initialLocale);
if (failed.length) console.log(`\n! Carte vide pour : ${failed.join(', ')}. Relancer avec --lang ${failed.join(',')}`);
console.log(`\nCaptures dans ${RAW}. Visuels : node generate.mjs --target android-wear`);
