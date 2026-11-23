#!/usr/bin/env node
// Prend les captures brutes iPhone ou iPad dans chaque langue, sur le simulateur démarré.
//
//   node capture/capture-ios.mjs                  iPhone, toutes les langues
//   node capture/capture-ios.mjs --device ipad    iPad (raw/ipad/)
//   node capture/capture-ios.mjs --lang fr,de     certaines langues
//   node capture/capture-ios.mjs --no-home        sans le visuel 1 (écran d'accueil + écran verrouillé)
//
// Prérequis (une fois) : Kelec installé et connecté au compte démo ; widgets posés sur la première page de
// l'écran d'accueil et sur l'écran verrouillé ; Maestro installé (brew install mobile-dev-inc/tap/maestro).
// Le simulateur est piloté sans l'app Simulator : ne pas y toucher pendant la capture.
//
// Par langue : langue du simulateur + redémarrage (les widgets et l'écran verrouillé suivent la langue du système),
// barre d'état figée, 1.png (écran d'accueil), 2 à 5 via Maestro (ios-app.yaml), 1bis.png (écran verrouillé).

import { mkdirSync, rmSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { LANGS } from '../config.mjs';
import { HERE, LOCALES, captureApp, maestro, parseArgs, run, sleep } from './common.mjs';

// Simulateur visé (un seul démarré par type) et cible de generate.mjs.
const DEVICES = {
  iphone: { match: /iPhone/, target: 'ios-iphone-6.3', wakeAfterLock: false },
  ipad: { match: /iPad/, target: 'ios-ipad-13', wakeAfterLock: true },
};

const { langs, withHome, value } = parseArgs(LANGS);
const kind = value('--device') ?? 'iphone';
if (!DEVICES[kind]) throw new Error(`Appareil inconnu : ${kind} (${Object.keys(DEVICES).join(', ')})`);
const RAW = resolve(HERE, '../raw', kind);

const simctl = (...a) => run('xcrun', ['simctl', ...a]);

function bootedDevice() {
  const { devices } = JSON.parse(simctl('list', 'devices', 'booted', '-j'));
  const booted = Object.values(devices).flat().filter((d) => d.state === 'Booted' && DEVICES[kind].match.test(d.name));
  if (booted.length !== 1) throw new Error(`Il faut exactement un simulateur ${kind} démarré (trouvés : ${booted.length})`);
  return booted[0];
}

function setLanguage(udid, lang) {
  const [appleLang, locale] = LOCALES[lang];
  simctl('spawn', udid, 'defaults', 'write', '-g', 'AppleLanguages', '-array', appleLang);
  simctl('spawn', udid, 'defaults', 'write', '-g', 'AppleLocale', '-string', locale);
  simctl('shutdown', udid);
  simctl('boot', udid);
  simctl('bootstatus', udid, '-b');
  waitForHomeScreen(udid);
}

// bootstatus rend la main avant la fin de l'animation de démarrage (logo Apple sur fond noir).
// On attend une capture « lourde » : le logo fait ~70 Ko, l'écran d'accueil plusieurs Mo.
function waitForHomeScreen(udid) {
  const probe = join(HERE, '.probe.png');
  for (let i = 0; i < 60; i++) {
    simctl('io', udid, 'screenshot', probe);
    if (statSync(probe).size > 1_000_000) break;
    sleep(2);
  }
  rmSync(probe, { force: true });
  sleep(6); // le temps que les widgets se chargent
}

function freezeStatusBar(udid) {
  simctl('status_bar', udid, 'override', '--time', '9:41', '--dataNetwork', 'wifi', '--wifiMode', 'active',
    '--wifiBars', '3', '--cellularMode', 'active', '--cellularBars', '4', '--batteryState', 'charged', '--batteryLevel', '100');
}

const device = bootedDevice();
console.log(`Simulateur : ${device.name} (${device.udid})`);
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
const failed = [];

for (const lang of langs) {
  if (!LOCALES[lang]) throw new Error(`Langue inconnue : ${lang}`);
  const out = join(RAW, lang);
  mkdirSync(out, { recursive: true });
  console.log(`\n== ${lang}`);

  setLanguage(device.udid, lang);
  freezeStatusBar(device.udid);

  if (withHome) simctl('io', device.udid, 'screenshot', join(out, '1.png'));

  if (!(await captureApp(page, device.udid, 'ios-app.yaml', out))) failed.push(lang);

  if (withHome) {
    freezeStatusBar(device.udid); // de nouveau : l'heure de l'écran verrouillé n'est pas toujours figée au premier essai
    maestro(device.udid, 'ios-lock.yaml');
    if (DEVICES[kind].wakeAfterLock) {
      sleep(2);
      maestro(device.udid, 'ios-wake.yaml');
    }
    sleep(3);
    simctl('io', device.udid, 'screenshot', join(out, '1bis.png'));
  }
}

await browser.close();
if (failed.length) console.log(`\n! Parcours ou carte en échec pour : ${failed.join(', ')}. Relancer avec --lang ${failed.join(',')}`);
console.log(`\nCaptures dans ${RAW}. Visuels : node generate.mjs --target ${DEVICES[kind].target}`);
