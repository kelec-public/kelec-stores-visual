#!/usr/bin/env node
// Prend les captures brutes Android dans chaque langue, sur l'émulateur démarré.
//
//   node capture/capture-android.mjs                  toutes les langues
//   node capture/capture-android.mjs --lang fr,de     certaines langues
//   node capture/capture-android.mjs --no-home        sans le visuel 1 (écran d'accueil)
//   node capture/capture-android.mjs --no-app         seulement le visuel 1
//   node capture/capture-android.mjs --serial emulator-5580   si plusieurs appareils sont branchés
//
// Prérequis (une fois) : Kelec en release installé et connecté au compte démo, tarif saisi ; widgets Kelec sur la
// première page de l'écran d'accueil ; Maestro installé. Ne pas toucher à l'émulateur pendant la capture.
//
// Par langue : langue du système (cmd locale set-device-locale, sans redémarrage : l'app, le lanceur et les widgets
// suivent), barre d'état figée (mode démo), 1.png (écran d'accueil), 2 à 5 via Maestro (android-app.yaml).
// Pas de 1bis.png : un téléphone Android n'a pas de widgets sur l'écran verrouillé, le visuel 1 n'a qu'un appareil.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { LANGS } from '../config.mjs';
import { HERE, LOCALES, captureApp, parseArgs, run, sleep } from './common.mjs';

const APP_ID = 'com.myrenaultplus';
const RAW = resolve(HERE, '../raw/android');

const { langs, withHome, value } = parseArgs(LANGS);
const withApp = !process.argv.includes('--no-app');

function pickDevice() {
  const wanted = value('--serial');
  if (wanted) return wanted;
  const serials = run('adb', ['devices'])
    .split('\n')
    .slice(1)
    .filter((l) => /\tdevice$/.test(l))
    .map((l) => l.split('\t')[0]);
  if (serials.length !== 1) {
    throw new Error(`Il faut exactement un appareil Android (trouvés : ${serials.length}). Sinon : --serial <id>`);
  }
  return serials[0];
}

const serial = pickDevice();
const adb = (...a) => run('adb', ['-s', serial, ...a]);
const shell = (cmd) => adb('shell', cmd).trim();

function screenshot(path) {
  writeFileSync(path, run('adb', ['-s', serial, 'exec-out', 'screencap', '-p'], { encoding: 'buffer', maxBuffer: 64 << 20 }));
}

// Langue du système (Android 15 et plus). Le lanceur, les widgets et l'app sont redessinés dans la nouvelle langue.
function setLanguage(lang) {
  const tag = LOCALES[lang][1].replace('_', '-');
  shell(`cmd locale set-device-locale ${tag}`);
  const now = shell('cmd locale get-device-locale');
  if (now !== tag) throw new Error(`Langue non appliquée : ${now} au lieu de ${tag}`);
  // L'app doit repartir de zéro pour relire la langue.
  shell(`am force-stop ${APP_ID}`);
}

// Mode démo de SystemUI : 9:41, wifi plein (sans réseau mobile, qui ajoutait « 3G » et un second wifi),
// batterie pleine, ni notifications ni icônes d'état (alarme, ne pas déranger…).
function freezeStatusBar() {
  const demo = (args) => shell(`am broadcast -a com.android.systemui.demo -e command ${args}`);
  shell('settings put global sysui_demo_allowed 1');
  demo('enter');
  demo('clock -e hhmm 0941');
  demo('network -e mobile hide -e satellite hide -e airplane hide');
  demo('network -e wifi show -e level 4 -e fully true');
  demo('battery -e level 100 -e plugged false');
  demo('notifications -e visible false');
  // Le mode démo ne cache pas les icônes de notification sur Android 17 : on met les notifications en sourdine
  // pour une heure (Safety Center, protection antivol…).
  for (const key of shell('cmd notification list').split(/\r?\n/).filter(Boolean)) {
    shell(`cmd notification snooze --for 3600000 '${key}'`);
  }
  demo('status -e volume hide -e bluetooth hide -e location hide -e alarm hide -e sync hide -e tty hide ' +
    '-e eri hide -e mute hide -e speakerphone hide -e zen hide -e managed_profile hide');
}

// Écran d'accueil, première page. Deux appuis sur Home : le second ramène à la première page.
// Les widgets se redessinent après le changement de langue : on attend qu'ils aient fini.
function captureHome(out) {
  shell('wm dismiss-keyguard');
  shell('input keyevent KEYCODE_HOME');
  sleep(1);
  shell('input keyevent KEYCODE_HOME');
  sleep(8);
  screenshot(join(out, '1.png'));
}

console.log(`Appareil : ${serial} (${shell('getprop ro.product.model')}, Android ${shell('getprop ro.build.version.release')})`);
if (!shell(`pm list packages ${APP_ID}`).includes(APP_ID)) throw new Error(`${APP_ID} n'est pas installée`);

const initialLocale = shell('cmd locale get-device-locale');
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
const failed = [];

try {
  for (const lang of langs) {
    if (!LOCALES[lang]) throw new Error(`Langue inconnue : ${lang}`);
    const out = join(RAW, lang);
    mkdirSync(out, { recursive: true });
    console.log(`\n== ${lang}`);

    setLanguage(lang);
    freezeStatusBar();
    if (withHome) captureHome(out);
    if (withApp && !(await captureApp(page, serial, 'android-app.yaml', out))) failed.push(lang);
  }
} finally {
  await browser.close();
  // Remet la langue de départ et la vraie barre d'état.
  shell(`cmd locale set-device-locale ${initialLocale}`);
  shell('am broadcast -a com.android.systemui.demo -e command exit');
}

if (failed.length) console.log(`\n! Parcours ou carte en échec pour : ${failed.join(', ')}. Relancer avec --lang ${failed.join(',')}`);
console.log(`\nCaptures dans ${RAW}. Visuels : node generate.mjs --target android-phone`);
