# Capture automatique Android

`capture/capture-android.mjs` prend les captures brutes des 5 visuels dans chaque langue, sur l'émulateur démarré.
Il le pilote par `adb` et Maestro : **ne pas toucher à l'émulateur pendant la capture.**

| | |
|---|---|
| Émulateur | `Pixel_10a` (1080×2424), Android 17 (API 37), image Google Play |
| Captures | `raw/android/<langue>/1.png … 5.png` |
| Cible | `android-phone` (1440×2560, 9:16 comme le demande la Play Console) |
| Cadre | `frames/android.png`, tiré de l'habillage de l'émulateur (`sdk/skins/pixel_10a/back.webp`), passé en noir |

## Préparer une fois

1. **Démarrer l'émulateur** (Android Studio, ou en ligne de commande) :
   ```bash
   ~/Library/Android/sdk/emulator/emulator -avd Pixel_10a &
   ```
   Un seul appareil branché, sinon passer `--serial emulator-5554`.
2. **Kelec en release** (`com.myrenaultplus`). Une build debug sans Metro s'arrête sur « Unable to load script ».
   Dans Android Studio : *Build › Select Build Variant*, `:app` en `release`, puis Run. Ou :
   ```bash
   cd ../kelec-app/android && ./gradlew :app:installRelease
   ```
   **Toujours `:app:`.** Un `./gradlew installRelease` sans module installe aussi `:wear`, qui a le même
   `applicationId` : l'app de la montre remplace celle du téléphone. Son `versionCode` (2000300) étant plus grand,
   il faut ensuite désinstaller complètement l'app (connexion et widgets perdus) pour remettre celle du téléphone.
3. **Compte démo** connecté (`kelec-demo@gmail.com` / `demo`) : Renault, « Demo car » (AA-001-AA), Megane E-Tech
   60 kWh / AC 22 kW, renommée « Megane E-Tech » (onglet Compte), **tarif fixe 0,20 €/kWh** depuis le début
   (Historique des charges › bandeau du tarif), comme sur iOS.
4. **Widgets Kelec** sur la **première page** de l'écran d'accueil, remplis (pas le logo gris de chargement).
5. **Maestro** installé (`brew install mobile-dev-inc/tap/maestro`), **aucun proxy sur le Mac**.

Pour garder cet état, quitter l'émulateur normalement : l'état est sauvegardé (démarrage rapide).

## Lancer

```bash
node capture/capture-android.mjs                     # 21 langues
node capture/capture-android.mjs --lang fr,de        # quelques langues
node capture/capture-android.mjs --no-home           # sans le visuel 1 (écran d'accueil)
node capture/capture-android.mjs --no-app            # seulement le visuel 1

node generate.mjs --target android-phone
```

## Ce que fait le script, par langue

1. Change la langue du système avec `cmd locale set-device-locale fr-FR` (Android 15 et plus). **Pas de redémarrage**,
   contrairement à iOS : le lanceur, les widgets et l'app suivent la langue. L'app est arrêtée pour relire la langue
   (`NativeLanguage.getLanguage()` lit `resources.configuration.locales[0]`).
2. Fige la barre d'état avec le mode démo de SystemUI (`com.android.systemui.demo`) : 9:41, wifi plein, batterie pleine,
   ni réseau mobile ni icônes d'état. Les notifications sont mises en sourdine pour une heure
   (`cmd notification snooze`) : sur Android 17, le mode démo ne cache plus leurs icônes.
3. Visuels 2 à 5 : parcours Maestro `capture/android-app.yaml`, le même que sur iOS (mêmes `testID`), avec la même
   vérification de la carte et les mêmes essais (voir [capture-ios.md](capture-ios.md)).
4. `1.png`, après l'app (son passage rafraîchit les widgets dans la nouvelle langue) : Home deux fois (le second
   appui revient à la première page), puis attente que les widgets affichent leurs textes (`uiautomator dump`,
   textes du paquet `com.myrenaultplus` identiques sur deux relevés à 3 s d'écart, 60 s au plus), puis `screencap`.

À la fin, la langue de départ et la vraie barre d'état sont remises.

**Pas de `1bis.png`** : un téléphone Android n'a pas de widgets sur l'écran verrouillé. Le visuel 1 Android n'a
qu'un appareil (l'écran d'accueil avec les widgets).

## Différences avec iOS

| | iOS | Android |
|---|---|---|
| Langue | `defaults write` + redémarrage du simulateur (~1 min) | `cmd locale set-device-locale`, immédiat |
| Barre d'état | `simctl status_bar override` | mode démo de SystemUI + notifications en sourdine |
| Capture système | `simctl io screenshot` | `adb exec-out screencap -p` |
| Visuel 1 | accueil + écran verrouillé | accueil seulement |
| Carte | Apple Plans | Google Maps (`react-native-maps`) : le seuil de couleur est le même, à revoir s'il refait le parcours sans raison |

## Commandes utiles

```bash
adb devices                                              # appareils branchés
adb shell cmd locale get-device-locale                   # langue actuelle
adb shell cmd locale set-device-locale fr-FR             # changer de langue à la main
adb exec-out screencap -p > capture.png                  # capture d'écran
adb shell am broadcast -a com.android.systemui.demo -e command exit   # quitter le mode démo
maestro --device emulator-5554 test --test-output-dir=/tmp/maestro-out capture/android-app.yaml
```
