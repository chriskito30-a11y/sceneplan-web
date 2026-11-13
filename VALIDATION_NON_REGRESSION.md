# ScènePlan V4 — Vérifications de non-régression

**Date :** 13 novembre 2026.

## Sauvegarde de la V3

Branche dédiée créée **avant** la modification : `backup/v3-2026-11-13`, basée sur le commit `25b09de3a1a86cacc59e1234ff70c7dbe9918614`.

## Tests exécutés

- **196 assertions V3 réussies**, 0 échec, lors de la réexécution de la suite historique V2/V3.
- **96 assertions V4 réussies**, 0 échec : parcours PC et téléphone simulé, interface, sélection, déplacements, zoom, musique, import/export et conversion ArrangeUs.
- **59 assertions V4 supplémentaires réussies**, 0 échec : ajout, duplication, réordonnancement et suppression de formations ; BPM, transitions, accessoires, modèles automatiques, trajectoires, fantômes, vue 3D simplifiée, dimensions, zoom tactile à deux doigts, redimensionnement/orientation.

**Total : 155 assertions V4 réussies sans échec**, indépendamment des 196 assertions de référence V3.

Parcours couverts : changement de mode Placement/Synchronisation/Focus sans modification des projets ; panneau droit et outils repliables ; sélection et désélection, déplacements groupés rigides, annuler/refaire, zoom et ajustement de scène ; gestion des tableaux, édition des durées et du BPM ; curseur musical, lecture/pause WAV ; import et export JSON réimporté ; conversion du fichier ArrangeUs témoin (23 artistes, 3 formations, 69 positions).

## Ce qui reste à vérifier sur appareil réel

Tests sous **Chromium** avec résolutions 1440×900, 390×844 et redimensionnements jusqu'à 844×390 ; gestes tactiles simulés. **Pas de validation sur téléphone physique**, Safari ou Firefox.

L'environnement interdit la navigation directe vers `file://` et vers une origine HTTPS locale ; la persistance IndexedDB après rechargement sur serveur HTTPS, l'exécution du service worker et le déchiffrement AES `.arrus` en contexte HTTPS ne sont donc **pas revalidés en production**. L'import témoin a été contrôlé par déchiffrement local hors navigateur puis conversion JSON. Aucun projet utilisateur ni fichier APK n'a été ajouté au dépôt.

Les tests réduisent le risque de régression mais ne constituent pas une garantie absolue de couverture exhaustive.
