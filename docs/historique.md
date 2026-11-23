# Historique (20–21 novembre 2026)

Ce qui a été fait pour produire les visuels App Store, dans l'ordre, avec les choix et les problèmes rencontrés.

## Point de départ

- Un template Figma (`stores-screens`), uniquement en français et pour iPhone : 5 visuels, des maquettes de téléphone
  déjà composées (cadre + capture en une image).
- Le but : ne fournir que des captures brutes et tout générer dans les 21 langues de l'app.

## Choix

| Choix | Pourquoi |
|---|---|
| Générateur HTML + Chrome (`playwright-core`) plutôt que Figma | Le compte Figma n'a qu'un siège « View » sur un plan Starter, avec très peu d'appels MCP par mois ; générer des centaines d'images dans Figma n'était pas réaliste. Figma sert seulement de référence (couleurs, tailles, positions). |
| Panorama rendu d'un bloc puis découpé | Le dégradé est continu sur les 5 visuels, comme dans Figma. |
| Cadres Apple (« Product Bezels ») détectés automatiquement | Remplacer un cadre ne demande aucun code. Le premier cadre iPhone était extrait de la maquette Figma (écran détouré) ; il a été remplacé par le bezel officiel. |
| iPhone 6.3" et iPad 13" seulement | Ce sont les tailles demandées par App Store Connect. |
| Maestro + `simctl` pour la capture | Parcours en YAML, même outil possible plus tard pour Android ; `simctl` pour la langue, la barre d'état et les captures système. |
| Langue changée au niveau du simulateur, avec redémarrage | Les widgets et l'écran verrouillé suivent la langue du système, pas celle de l'app : c'est ce qui permet d'automatiser aussi le visuel 1. |
| Taps par `testID` | Le texte change avec la langue. Les `testID` existaient déjà dans kelec-app. |
| Dossier séparé `kelec-stores-visual` | D'abord créé dans `kelec-app/store-visuals`, déplacé ensuite ; les polices NouvelR ont été copiées dans `fonts/` pour qu'il fonctionne seul. |

## Étapes

1. Lecture du template Figma (couleurs, police NouvelR, positions) et écriture du générateur.
2. Traduction des titres dans les 20 autres langues (`texts.json`).
3. Remplacement des cadres par les bezels Apple, passage de l'iPhone en 6.3" (1206×2622).
4. Script de capture iPhone : langue + redémarrage, barre d'état figée, parcours Maestro, verrouillage.
5. Capture iPhone des 21 langues, puis nouvelle capture après la saisie des prix dans l'app démo.
6. Néerlandais refait après une correction dans l'app (« Klimaatregeling op afstand »).
7. Déménagement vers `kelec-stores-visual`.
8. iPad : création du simulateur iPad Pro 13-inch (M5), réveil de l'écran après verrouillage, capture des 21 langues.

## Problèmes rencontrés et solutions

| Problème | Solution |
|---|---|
| `getImageData` refusé par Chrome sur le cadre (`file://`) | Cadre passé en data URL. |
| Coins blancs de la capture qui dépassaient du cadre Apple | Détection du rayon corrigée : sur les bezels Apple, le coin du rectangle de l'écran est hors du téléphone (transparent). |
| Maestro refuse d'écrire hors de son dossier de sortie, et lit `takeScreenshot: 2` comme un nombre | Dossier de sortie temporaire recopié dans `raw/`, noms entre guillemets. |
| `back` n'existe pas sur iOS | L'app est relancée avant le visuel 5. |
| L'app Simulator n'existe pas avec ce Xcode (⌘L impossible) | Verrouillage par Maestro (`pressKey: Lock`). |
| `1.png` pris pendant le logo Apple | Attente d'une capture de plus de 1 Mo. |
| Cartes vides à partir de l'espagnol | Proxy Proxyman actif sur le Mac ; le simulateur refusait son certificat pour `*.ls.apple.com`. Proxy coupé, et le script vérifie maintenant la carte et refait le parcours si elle est vide. |
| `iOS driver not ready in time` (iPad, espagnol) | Délai de démarrage de Maestro porté à 3 min, et un échec de Maestro devient un essai raté au lieu d'arrêter tout. |
| Écran verrouillé noir sur iPad | Appui sur Home après le verrouillage (iPad seulement). |

## État au 21 novembre

- iPhone 6.3" : 21 langues capturées et générées.
- iPad 13" : 21 langues capturées et générées.
- **Reste à faire :**
  - Écran verrouillé grec (iPhone et iPad) à l'heure réelle au lieu de 9:41 : relancer `--lang el` à 9:41 ou 21:41.
  - Titre du visuel 5 (« Préchauffage ») à aligner ou non sur le nom dans l'app (« Confort thermique »).
  - Android : voir plus bas.
  - L'image de présentation Play Store (1024×500).

## Android (23 novembre)

| Choix | Pourquoi |
|---|---|
| Émulateur `Pixel_10a` (Android 17) | Déjà installé ; un émulateur donne le même rendu d'une langue à l'autre. |
| `cmd locale set-device-locale` plutôt qu'un redémarrage avec `-change-locale` | Disponible depuis Android 15, sans root ni redémarrage : le lanceur, les widgets et l'app suivent la langue. |
| Langue du système plutôt que la langue de l'app (`set-app-locales`) | Le visuel 1 montre l'écran d'accueil : la date et les noms d'apps doivent aussi être traduits. |
| Même parcours Maestro qu'iOS | Les `testID` React Native sont lus comme des `id` sur Android aussi. |
| Pas de second appareil au visuel 1 | Pas de widgets sur l'écran verrouillé d'un téléphone Android. |
| Cadre tiré de l'habillage de l'émulateur, passé en noir | Google ne publie pas de bezels comme Apple ; l'habillage du Pixel 10a a déjà l'écran transparent et la caméra. Le corail d'origine jurait avec le dégradé orange. |
| Code commun iOS / Android dans `capture/common.mjs` | Langues, essais du parcours, vérification de la carte. |

| Problème | Solution |
|---|---|
| Barre d'état : « 3G », deux icônes wifi | Réseau mobile caché dans le mode démo. |
| Icônes de notifications (bouclier Safety Center) malgré `notifications -e visible false` | Notifications mises en sourdine une heure (`cmd notification snooze`). |
| Kelec debug installé sur l'émulateur : « Unable to load script » sans Metro | Installer une build release avant la capture. |

État : script, parcours, cadre et doc prêts ; changement de langue, barre d'état et capture de l'accueil testés.
**Reste** : installer Kelec release sur l'émulateur, connecter le compte démo, remplir les widgets, puis lancer
la capture et vérifier le parcours Maestro (pas encore testé sur Android).
