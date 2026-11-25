// Partagé par capture-ios.mjs et capture-android.mjs.

import { execFileSync } from 'node:child_process';
import { copyFileSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = dirname(fileURLToPath(import.meta.url));

// Langue iOS et région de chaque langue de l'app (pt = Portugal, pas Brésil).
// Sur Android, la région donne la balise : pt_PT → pt-PT.
export const LOCALES = {
  bg: ['bg', 'bg_BG'], ca: ['ca', 'ca_ES'], cs: ['cs', 'cs_CZ'], da: ['da', 'da_DK'], de: ['de', 'de_DE'],
  el: ['el', 'el_GR'], en: ['en', 'en_US'], es: ['es', 'es_ES'], fi: ['fi', 'fi_FI'], fr: ['fr', 'fr_FR'],
  hr: ['hr', 'hr_HR'], hu: ['hu', 'hu_HU'], it: ['it', 'it_IT'], nb: ['nb', 'nb_NO'], nl: ['nl', 'nl_NL'],
  pl: ['pl', 'pl_PL'], pt: ['pt-PT', 'pt_PT'], ro: ['ro', 'ro_RO'], sl: ['sl', 'sl_SI'], sv: ['sv', 'sv_SE'],
  tr: ['tr', 'tr_TR'],
};

export const run = (cmd, cmdArgs, opts = {}) => execFileSync(cmd, cmdArgs, { encoding: 'utf8', ...opts });
export const sleep = (s) => run('sleep', [String(s)]);

export function parseArgs(allLangs) {
  const args = process.argv.slice(2);
  const value = (name) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  return {
    langs: value('--lang')?.split(',') ?? allLangs,
    withHome: !args.includes('--no-home'),
    value,
  };
}

// Lance un parcours Maestro. Après un redémarrage, le pilote de Maestro met parfois plus que le délai par défaut
// à démarrer (iOS surtout).
export function maestro(device, flow, extra = []) {
  run('maestro', ['--device', device, 'test', ...extra, join(HERE, flow)], {
    stdio: 'inherit',
    env: { ...process.env, MAESTRO_DRIVER_STARTUP_TIMEOUT: '180000' },
  });
}

// Part de pixels colorés (parcs, eau, lieux) sur la carte plein écran (3.png). Quand les tuiles ne sont pas
// chargées, la carte n'est qu'une grille beige ou grise : la part tombe à ~0.
export async function mapColorRatio(page, path) {
  const src = `data:image/png;base64,${readFileSync(path).toString('base64')}`;
  return page.evaluate(async (url) => {
    const img = new Image();
    img.src = url;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = 200; c.height = 200;
    const ctx = c.getContext('2d');
    // Zone de la carte, sans la barre d'état ni les boutons du bas.
    ctx.drawImage(img, 0, img.height * 0.15, img.width, img.height * 0.7, 0, 0, 200, 200);
    const d = ctx.getImageData(0, 0, 200, 200).data;
    let colored = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]) > 45) colored++;
    }
    return colored / (d.length / 4);
  }, src);
}

const MAP_MIN_RATIO = 0.03;
const ATTEMPTS = 4;

// Visuels 2 à 5. Maestro n'écrit ses captures que dans son dossier de sortie (sous-dossiers datés) : on les recopie.
// Le parcours est refait si Maestro échoue ou si la carte est vide.
export async function captureApp(page, device, flow, out) {
  const tmp = join(HERE, '.maestro-out');
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    rmSync(tmp, { recursive: true, force: true });
    try {
      maestro(device, flow, [`--test-output-dir=${tmp}`]);
    } catch {
      console.log(`  parcours Maestro en échec, essai ${attempt}/${ATTEMPTS}`);
      if (attempt < ATTEMPTS) sleep(20 * attempt);
      continue;
    }
    for (const f of readdirSync(tmp, { recursive: true })) {
      if (/takeScreenshot\/\d\.png$/.test(f)) copyFileSync(join(tmp, f), join(out, f.split('/').pop()));
    }
    rmSync(tmp, { recursive: true, force: true });
    const ratio = await mapColorRatio(page, join(out, '3.png'));
    if (ratio >= MAP_MIN_RATIO) return true;
    console.log(`  carte vide (${(ratio * 100).toFixed(1)} % de couleur), essai ${attempt}/${ATTEMPTS}`);
    if (attempt < ATTEMPTS) sleep(20 * attempt); // laisse le temps aux tuiles de se charger
  }
  return false;
}
