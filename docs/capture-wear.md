# Capture automatique Wear OS

`capture/capture-wear.mjs` prend 3 captures par langue sur l'émulateur de montre : `raw/wear/<langue>/1.png … 3.png`
(1 page voiture, 2 carte, 3 feuille de préchauffage). Cible `android-wear` (1080×1080, 1:1 comme le demande la Play
Console), cadre `frames/wear.png` (rond, tiré de `sdk/skins/wearos_xl_round/device_bezel.png`). Titres : les visuels
1, 3 et 5 de `texts.json`.

## Préparer une fois
1. Émulateur **Wear OS XL Round** (`Wear_OS_XL_Round`, image Google Play) appairé au `Pixel_10a` (Device Manager ›
   Pair Wearable).
2. Kelec **`:wear`** installé sur la montre, `:app` sur le téléphone (même `applicationId` : chaque module sur son
   appareil, voir [capture-android.md](capture-android.md)). Compte démo synchronisé : « Megane E-Tech », 56 %.

## Lancer
```bash
node capture/capture-wear.mjs --lang fr,de      # ~1 min par langue
node capture/capture-wear.mjs                   # 21 langues (--serial emulator-5556 s'il y a plusieurs montres)
node generate.mjs --target android-wear
```
Rien à toucher pendant la capture, mais pas besoin de la souris : le script utilise `adb input tap` et `cmd locale
set-device-locale`. Il remet la langue de départ à la fin. Le bouton de confirmation n'est jamais touché.

## Limites
- L'émulateur n'est pas root : l'heure du système (et de la montre) ne peut pas être figée, elle varie d'une langue à l'autre.
- Les positions des boutons (`BTN` dans le script) valent pour l'écran 480×480.
- La carte est ronde dans l'app, avec un léger halo blanc sur le bord.
