# Génération des visuels

`generate.mjs` transforme les captures brutes en visuels stores. Pour chaque cible et chaque langue, il construit une
page HTML qui fait le panorama des 5 visuels, la rend dans Chrome (`playwright-core`, avec le Google Chrome installé
sur le Mac) et la découpe en 5 PNG.

```bash
node generate.mjs                                         # toutes les cibles qui ont des captures, 21 langues
node generate.mjs --target ios-ipad-13 --lang fr,de,el
```

Sortie : `out/<cible>/<langue>/01.png … 05.png` aux dimensions du store, plus `panorama.png` (les 5 côte à côte) pour
relire. Une cible sans captures (`raw/<appareil>/` vide) est ignorée. Une langue prend ~2 s.

## Mise en page (template Figma `stores-screens`)

Reprise du fichier Figma `stores-screens` (frames de 1320×2868, page « fr ios ») :

- **Fond** : dégradé continu sur les 5 visuels, `#ff9664` à gauche → `#d24a14` à droite. Comme dans Figma, il déborde
  un peu à droite (6760 px pour 5 × 1320). Il est rendu sur tout le panorama puis découpé : les visuels sont raccord.
- **Titre** : NouvelR 120 px (taille Figma), centré, à 106 px du haut. Première ligne en Regular blanc, seconde en
  Bold bleu `#3171de`.
- **Appareil** : centré, 450 px du haut, 2282 px de haut dans Figma.
- **Visuel 1** : un second appareil (`1bis.png`) décalé vers le bas et posé par-dessus (écran verrouillé).

Les valeurs Figma sont mises à l'échelle pour chaque cible dans `config.mjs` (`title`, `device`).

## Cadres (`frames/`)

Un cadre est un PNG avec l'écran transparent. `frames/iphone.png` et `frames/ipad.png` sont les « Product Bezels »
d'Apple (developer.apple.com/design/resources : iPhone 18 et iPad Pro (M5) 13", en portrait).

Rien à configurer : la page lit les pixels du cadre et trouve seule l'écran (zone transparente autour du centre) et le
rayon de ses coins. La capture est posée dessous, dans le même arrondi. Le cadre est passé en data URL, sinon Chrome
refuse de lire les pixels d'un fichier `file://`.

Pour changer de cadre, il suffit de remplacer le PNG. Sans `frames/android.png`, la cible Android dessine un cadre
simple en CSS (`cssFrame` dans `config.mjs`).

## Textes (`texts.json`)

Deux lignes par visuel et par langue : `[ligne blanche, ligne bleue en gras]`.

- Le français vient du Figma, corrigé : « Et localisez-**la** » (le Figma a « localisez là »).
- Les 20 autres langues ont été traduites pour ces visuels. Elles sont indépendantes de
  `kelec-app/src/lib/model/localization/localizations.json`, qui n'est pas touché.
- Une ligne trop large est réduite pour tenir. Sous 80 % de la taille normale, le script affiche un avertissement :
  il vaut mieux raccourcir le texte. Les titres longs du grec, du bulgare et du turc ont été raccourcis ainsi.
- La police NouvelR couvre tous les alphabets utilisés (latin étendu, grec, cyrillique, turc).

Point ouvert : le visuel 5 dit « Préchauffage », l'app dit « Confort thermique » (en néerlandais
« Klimaatregeling op afstand »).

## Captures manquantes

Une capture absente dans une langue est reprise du français (`FALLBACK_LANG` dans `config.mjs`), avec un avertissement
à la fin. Si elle manque aussi en français, l'appareil est dessiné avec un écran vide.

## Ajouter une cible

Ajouter une entrée dans `TARGETS` (`config.mjs`) : taille du store, cadre, dossier `raw`, position du titre et de
l'appareil. Exemple pour l'iPad :

```js
'ios-ipad-13': {
  store: 'ios', width: 2064, height: 2752,
  frame: 'frames/ipad.png', raw: 'ipad',
  title: { top: 130, fontSize: 150, sideMargin: 120 },
  device: { top: 560, height: 2100, bisOffset: 0.55 },
},
```
