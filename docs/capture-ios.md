# Capture automatique iOS (iPhone, iPad)

`capture/capture-ios.mjs` prend les captures brutes des 5 visuels dans chaque langue, sur un simulateur démarré.
Il pilote le simulateur sans l'app Simulator (`xcrun simctl` + Maestro) : **ne pas toucher au simulateur pendant la capture.**

## Préparer une fois par appareil

| | iPhone | iPad |
|---|---|---|
| Simulateur | iPhone 18 Pro (6.3", 1206×2622) | iPad Pro 13-inch (M5) (2064×2752) |
| Option du script | `--device iphone` (défaut) | `--device ipad` |
| Captures | `raw/iphone/<langue>/` | `raw/ipad/<langue>/` |

1. **Un seul simulateur de ce type démarré.** Un iPhone et un iPad peuvent tourner en même temps.
   Créer le simulateur iPad s'il n'existe pas :
   ```bash
   xcrun simctl create "iPad Pro 13-inch (M5)" \
     com.apple.CoreSimulator.SimDeviceType.iPad-Pro-13-inch-M5-12GB com.apple.CoreSimulator.SimRuntime.iOS-27-2
   ```
2. **Kelec installé** (`com.kelyanselme.MyRenault`), de préférence en Release.
3. **Compte démo** connecté (`kelec-demo@gmail.com` / `demo`), Mégane E-Tech en charge, **tarif d'électricité saisi**
   (sinon l'historique affiche le bandeau « Définissez votre tarif… » et pas de prix).
4. **Widgets Kelec** sur la **première page** de l'écran d'accueil et sur l'**écran verrouillé**.
   Ils restent en place d'une langue à l'autre.
5. **Maestro** : `brew install mobile-dev-inc/tap/maestro`.
6. **Aucun proxy sur le Mac** (Proxyman…) : voir « Carte vide » plus bas.

## Lancer

```bash
node capture/capture-ios.mjs                              # iPhone, 21 langues (~1 min 30 par langue)
node capture/capture-ios.mjs --device ipad                # iPad, 21 langues (~2 min par langue)
node capture/capture-ios.mjs --lang fr,de                 # quelques langues
node capture/capture-ios.mjs --no-home                    # sans le visuel 1 (accueil + écran verrouillé)

node generate.mjs --target ios-iphone-6.3                 # puis les visuels
node generate.mjs --target ios-ipad-13
```

Pour suivre une longue capture lancée en arrière-plan :
```bash
node capture/capture-ios.mjs --device ipad > capture.log 2>&1 &
grep -E "^== |essai|^! " capture.log        # langue en cours, essais ratés, langues en échec
```

## Ce que fait le script, par langue

1. Écrit la langue et la région du simulateur (`defaults write -g AppleLanguages / AppleLocale`, ex. `pt-PT` / `pt_PT`)
   puis le **redémarre** : l'app, les widgets et l'écran verrouillé suivent la langue du système.
   L'app lit `AppleLanguages` (`languageHandler.tsx`), elle n'a pas de langue à elle.
2. Attend la fin du démarrage : `bootstatus` rend la main pendant le logo Apple, le script attend donc une capture
   d'écran de plus de 1 Mo (le logo fait ~70 Ko), puis 6 s pour les widgets.
3. Fige la barre d'état : 9:41, wifi, réseau et batterie pleins (`simctl status_bar override`).
4. `1.png` : capture de l'écran d'accueil (`simctl io screenshot`).
5. Visuels 2 à 5 : parcours Maestro `capture/ios-app.yaml` (voir plus bas). Maestro n'écrit que dans son dossier
   de sortie : le script recopie `takeScreenshot/<n>.png` dans `raw/`.
6. Vérifie la carte (`3.png`) : part de pixels colorés (parcs, Seine, lieux) au milieu de l'écran.
   Sous 3 %, les tuiles ne sont pas chargées : le parcours est refait (4 essais, avec une pause de 20, 40 puis 60 s).
   Un échec du parcours Maestro compte aussi comme un essai raté.
7. `1bis.png` : refige la barre d'état, verrouille (`ios-lock.yaml`, `pressKey: Lock`), sur iPad rallume l'écran
   (`ios-wake.yaml`, `pressKey: Home`, l'écran de l'iPad s'éteint au verrouillage), puis capture.

À la fin, le script liste les langues en échec et la commande pour les relancer.

## Le parcours Maestro (`capture/ios-app.yaml`)

L'app avait déjà tous les `testID` nécessaires : aucune modification de kelec-app.
On tape sur des `id` et jamais sur du texte, qui change avec la langue.

| Visuel | Étapes (`testID`) |
|---|---|
| 2 | lancement, attente de `carViewTitle` |
| 3 | `fullScreenButton` (carte de la page voiture) ; capture ; `closeModalButton` |
| 4 | `ChargesCard` ; `showFiltersButton` ; `expandButtonenergyRecovered` ; `leftTextInputenergyRecovered` ← « 5 » ; `hideKeyboard` ; `confirmButton` |
| 5 | relance de l'app (iOS n'a pas de retour système) ; `HVACCardButton` ; attente de `temperatureText` ; capture ; `HVACModalCloseButton` |

Pour tester le parcours seul, sans changer de langue ni redémarrer :
```bash
maestro --device <udid> test --test-output-dir=/tmp/maestro-out capture/ios-app.yaml
```

## Dépannage

| Symptôme | Cause | Solution |
|---|---|---|
| Carte = grille beige vide (visuel 3, petite carte du visuel 2) | Un proxy du Mac (Proxyman, `127.0.0.1:9090`) intercepte le HTTPS de `*.ls.apple.com` ; le simulateur refuse son certificat (erreur -9813 dans les logs de `geod`). | Couper le proxy système (`scutil --proxy` doit montrer `HTTPSEnable : 0`), relancer les langues en échec. |
| `iOS driver not ready in time` | Après le redémarrage, le pilote XCTest de Maestro démarre lentement. | Déjà géré : délai porté à 3 min (`MAESTRO_DRIVER_STARTUP_TIMEOUT`) et nouvel essai. |
| `Tap on id: confirmButton... FAILED` (iPad) | De temps en temps sur iPad, le bouton de validation des filtres ne répond pas. | Déjà géré par les essais (it et pl sont passés au 2ᵉ et 3ᵉ essai). |
| Écran verrouillé en grec à l'heure réelle | En grec, l'écran verrouillé ignore l'heure figée de la barre d'état (iPhone et iPad ; ni `9:41` ni une date ISO ne marchent). | Relancer `--lang el` quand il est 9:41 ou 21:41. |
| `1.png` = logo Apple | Capture prise avant la fin du démarrage. | Déjà géré (attente d'une capture > 1 Mo). |
| `1bis.png` noir (iPad) | L'écran s'éteint au verrouillage. | Déjà géré (`ios-wake.yaml`). |
| Pas de widgets sur `1.png` | Widgets sur une autre page que la première. | Les remettre sur la première page de l'écran d'accueil. |

Logs du service de cartes du simulateur :
```bash
xcrun simctl spawn booted log show --last 5m --style compact \
  --predicate 'process == "geod" OR subsystem CONTAINS "GeoServices"' | grep -i -E "error|fail"
```

## Commandes utiles

```bash
xcrun simctl list devices booted                                   # simulateurs démarrés (et leur UDID)
xcrun simctl spawn booted defaults read -g AppleLanguages          # langue actuelle du simulateur
xcrun simctl io booted screenshot capture.png                      # capture d'écran

# Remettre un simulateur en français, avec la vraie barre d'état
U=<udid>
xcrun simctl spawn $U defaults write -g AppleLanguages -array fr
xcrun simctl spawn $U defaults write -g AppleLocale -string fr_FR
xcrun simctl shutdown $U && xcrun simctl boot $U
xcrun simctl status_bar $U clear
```
