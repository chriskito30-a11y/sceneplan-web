# Validation de non-régression — ScènePlan V3

Date : 13 novembre 2026

## Résultats des tests automatisés

- **196 assertions réussies, 0 échec** dans la suite qui rejoue des gestes et parcours sur l'ancienne V2 **et** la V3, en deux tailles de navigateur Chromium (ordinateur 1440 × 900, téléphone simulé 390 × 844).
- **14 assertions supplémentaires réussies** : glissement d'une poignée avec évènement tactile à un doigt, annulation, clic sur la forme d'onde, conversion du fichier ArrangeUs original, lecture sonore effective avec curseur synchronisé, pause, export JSON lisible.
- **Total : 210 assertions réussies, 0 échec**, dont des vérifications dupliquées volontairement entre les versions pour la comparaison.

## Fonctions historiques contrôlées en V2 et V3

- Initialisation, projets et accès à l'écran d'ouverture, réouverture du projet édité.
- Dimensions 7 × 2,5 m et proportions de la grille, conservation du mode « repères » sur le projet importé.
- Dessin des artistes, sélection / désélection, sélection groupée avec Maj sur PC ou appui tactile, déplacement rigide de groupe, annuler/refaire, zoom.
- Ajout / duplication de formations, navigation et changement de tableau.
- Basculer trajectoires, fantômes, vue 3D simplifiée, modèles, bibliothèque, modale.
- Import JSON du projet ArrangeUs converti (23 artistes, 3 tableaux) ; lecture du schéma déchiffré d'un fichier `.arrus` fourni (69 positions), mais pas import AES en navigateur sécurisé complet.
- Chargement d'un WAV original de test, calcul de sa durée, lecture effective, mise en pause et export JSON.

## Nouveautés contrôlées

- Edition du temps fixe et des transitions par boutons, champ numérique, synchronisation sur la position du curseur, gestuelle sur poignée tactile, respect de l'historique annuler/refaire.
- Prévisualisation des positions intermédiaires sans lecture active, changement de tableau au fil du curseur, maintien de la sélection du tableau à régler lorsqu'on cherche un instant au-delà de sa durée actuelle.
- Coherence panneau de timing / réglages de tableau, calage BPM 120 et 100, ajustement précis des transitions, waveform tactile, curseur de lecture.
- Panneau de timing mobile replié et dépliable ; compatibilité de l'UI bureau.

## Limites et périmètre

1. Les scripts sont exercés dans Chromium via insertion de l'HTML dans une page de test isolée : l'environnement bloque la navigation directe vers `file://` ou vers une origine HTTPS de test. La persistance IndexedDB et le déchiffrement du `.arrus` **dans la webapp servie sur HTTPS** ne sont donc **pas revalidés en conditions réelles**.
2. Les comportements tactiles sont testés par navigateur Chromium configuré comme mobile, avec évènements tactiles ; **pas sur le téléphone Android de l'utilisateur**.
3. Tous les comportements historiques ne font pas l'objet d'une preuve exhaustive ; les assertions couvrent les principaux parcours et les régressions déjà signalées. « 100 % équivalent ArrangeUs » n'est pas revendiqué.
4. L'export `.arrus`, les sauvegardes `.aubkp`, la vraie 3D et les PDF avancés ne sont pas livrés. Ils restent séparés des corrections de timeline.

## Décision

**Candidate à test réel sur téléphone**. Ne pas écraser une précédente sauvegarde sans export préalable. Conserver la V2 pour retour arrière. La validation finale nécessite un essai utilisateur sur l'appareil et, à terme, un contrôle en hébergement HTTPS.