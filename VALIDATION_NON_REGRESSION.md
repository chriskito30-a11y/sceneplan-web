# Tests de non-régression — ScènePlan V4.1

Date : 13 novembre 2026

## Références sécurisées

- V3 : `backup/v3-2026-11-13`
- V4 : `backup/v4-2026-11-13`, sauvegardée avant ce patch

## Tests avant / après

- Batterie historique V4 exécutée **avant** modification : **96 assertions passées** + **59 assertions avancées passées** (155/155, 0 échec).
- Même batterie après le correctif V4.1 : **96 + 59 assertions passées** (155/155, 0 échec).
- Batterie V4.1 complémentaire : **52 assertions passées**, PC Chromium 1440×900 et mobile simulé 390×844.

**Total V4.1 : 207 assertions réussies, 0 échec parmi les tests exécutés.**

### Parcours contrôlés

- Ouverture, navigation et changements de mode, scène réactive, réglages, outils.
- Sélection/désélection sans mouvement ni modification de dimensions du SVG ; `viewBox` strictement inchangé, même avec zoom personnalisé.
- Déplacement libre entre les repères ; annuler/refaire ; option Aimant activable/désactivable.
- Aimantation douce seulement à moins de 8px et 20% d'une case, déplacement libre ailleurs ; groupe déplacé sans changer les écarts entre artistes.
- Migration d'ancien projet vers Libre sans modification des coordonnées.
- Ajout/duplication/réordonnancement/suppression de tableaux, timeline, musique WAV, BPM, trajectoires, vue 3D simplifiée, accessoires, sélection multiple, zoom et pincement, changement de taille/orientation de l'écran.
- Import/export JSON ; conversion hors navigateur du fichier ArrangeUs v16 (23 artistes, 3 formations, 69 positions).

## Limites connues

Les tests ont été exécutés avec Chromium en environnement simulé, **pas sur le téléphone physique de l'utilisateur**. Une tentative de navigateur sur serveur HTTP localhost a échoué avec `ERR_BLOCKED_BY_ADMINISTRATOR` : la persistance IndexedDB après rechargement, le service worker et l'import natif .arrus chiffré en contexte HTTPS **n'ont donc pas été revalidés dans le navigateur final**. Aucune preuve exhaustive ne garantit l'absence de tout défaut ; seules les fonctionnalités effectivement testées sont déclarées passées.

## Vérification à réaliser sur appareil

Sélectionner/désélectionner, vérifier que la scène ne saute plus ; déplacer un artiste entre deux lignes en mode Libre ; activer Aimant et tester près puis loin d'un repère ; enregistrer puis réouvrir un projet existant.
