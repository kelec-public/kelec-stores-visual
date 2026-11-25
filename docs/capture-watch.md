# Capture automatique Apple Watch

`capture/capture-watch.mjs` prend 3 captures par langue sur le simulateur de montre : `raw/watch/<langue>/1.png … 3.png`
(1 page voiture, 2 carte, 3 feuille de confort thermique). Cible : `ios-watch-ultra` (422×514, Apple Watch Ultra 4),
cadre `frames/watch.png` (bezel Apple Watch Ultra, Ocean Band gris translucide). Titres : les visuels 1, 3 et 5 de `texts.json`.

## Préparer une fois
1. Démarrer la paire **iPhone 18 Pro + Apple Watch Ultra 4 (49 mm)** et installer Kelec (schéma `KelecWatchOs Watch App`
   dans Xcode). Le compte démo de l'iPhone doit être synchronisé : la montre affiche « Megane E-Tech », 56 %.
2. Ouvrir la montre dans **Device Hub**, fenêtre visible, sans la redimensionner ni changer le zoom.
3. Donner la permission **Accessibilité** au terminal (ou à T3 Code) : Réglages Système › Confidentialité et sécurité.
4. Aucun proxy sur le Mac (carte Apple Plans).

## Lancer
```bash
node capture/capture-watch.mjs --lang fr,de     # ~1 min 30 par langue
node capture/capture-watch.mjs                  # 21 langues
node generate.mjs --target ios-watch-ultra
```
Ne pas toucher à la souris pendant la capture : le script clique dans la fenêtre (`capture/watch-tap.swift`, compilé dans
`capture/.bin/`). « Confirmer » n'est jamais touché.

## Limites
- `simctl status_bar` ne marche pas sur watchOS : l'heure affichée est l'heure réelle, donc différente d'une langue à l'autre.
- Les positions des boutons (`BTN` dans le script) et l'échelle des clics (`watch-tap.swift`) dépendent du zoom de la fenêtre.
- Changer de langue redémarre la montre (~20 s).
