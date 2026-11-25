# Visuels stores Kelec

Génère les visuels App Store et Play Store de Kelec dans les 21 langues de l'app.
Deux étapes, chacune en une commande :

1. **Capture** : les captures d'écran brutes sont prises sur le simulateur iOS ou l'émulateur Android, langue par
   langue, par un script (Maestro + `simctl` ou `adb`) → `raw/<appareil>/<langue>/`.
2. **Génération** : chaque capture est posée dans un cadre d'appareil, sous un titre traduit, sur le dégradé du
   template Figma → `out/<cible>/<langue>/01.png … 05.png`.

```bash
npm install                                              # une fois

# Capture (simulateur démarré, voir docs/capture-ios.md)
node capture/capture-ios.mjs                             # iPhone, 21 langues
node capture/capture-ios.mjs --device ipad               # iPad, 21 langues
node capture/capture-ios.mjs --device ipad --lang fr,de  # quelques langues
node capture/capture-android.mjs                         # Android, 21 langues (voir docs/capture-android.md)

# Génération
node generate.mjs                                        # toutes les cibles qui ont des captures
node generate.mjs --target ios-iphone-6.3 --lang fr      # une cible, une langue
```

| Cible | Taille | Simulateur | Cadre |
|---|---|---|---|
| `ios-iphone-6.3` | 1206×2622 | iPhone 18 Pro | `frames/iphone.png` (Product Bezel Apple) |
| `ios-ipad-13` | 2064×2752 | iPad Pro 13-inch (M5) | `frames/ipad.png` (Product Bezel Apple) |
| `android-phone` | 1440×2560 | Pixel 10a (émulateur) | `frames/android.png` (habillage de l'émulateur) |
| `ios-watch-ultra` | 422×514 | Apple Watch Ultra 4 | `frames/watch.png` (Product Bezel Apple), 3 visuels : voiture, carte, préchauffage ([docs/capture-watch.md](docs/capture-watch.md)) |

App Store Connect ne demande que ces deux tailles iOS (iPhone 6.3", iPad 13"). Sur Android, le visuel 1 n'a que
l'écran d'accueil (pas de widgets sur l'écran verrouillé d'un téléphone Android).

## Les 5 visuels

| # | Titre (fr) | Écran |
|---|---|---|
| 1 | Votre voiture / à portée de main | Écran d'accueil avec les widgets (`1.png`) + écran verrouillé (`1bis.png`) |
| 2 | Suivez votre / E-TECH | Page voiture |
| 3 | Et localisez-la / au mètre près | Carte plein écran |
| 4 | Suivez et filtrez / vos recharges | Historique des charges, filtre « 5kWh < Énergie ajoutée » |
| 5 | Préchauffage / à distance | Feuille de confort thermique ouverte |

## Documentation

- [docs/capture-ios.md](docs/capture-ios.md) : préparer le simulateur, lancer la capture, dépanner.
- [docs/capture-android.md](docs/capture-android.md) : la même chose sur l'émulateur Android.
- [docs/generation.md](docs/generation.md) : mise en page, cadres, textes, ajouter une cible.
- [docs/historique.md](docs/historique.md) : ce qui a été fait, les choix et les problèmes rencontrés.

## Arborescence

```
capture/      capture-ios.mjs, capture-android.mjs (orchestration), common.mjs (partagé),
              ios-app.yaml / ios-lock.yaml / ios-wake.yaml / android-app.yaml (parcours Maestro)
config.mjs    langues, couleurs, tailles et positions par cible
generate.mjs  génération des visuels (HTML + Chrome via playwright-core)
texts.json    titres des 5 visuels dans les 21 langues
fonts/        NouvelR Regular et Bold (copiées de kelec-app/assets/fonts/Renault)
frames/       cadres d'appareils, écran transparent
raw/          captures brutes : raw/<iphone|ipad|android>/<langue>/<n>.png
out/          visuels générés (ignoré par git)
```
