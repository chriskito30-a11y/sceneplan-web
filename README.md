# ScènePlan — V3 (13 novembre 2026)

Webapp de placement scénique pour ordinateur et mobile. Prototype indépendant, non affilié à ArrangeUs.

## Fonctionnalités

- Éditeur tactile de scènes et de formations avec dimensions en mètres, sélection multiple, zoom et glissement de groupe.
- Transitions animées entre les positions, trajectoires courbes et historique annuler/refaire.
- Import de projets ScenePlan (JSON) et de fichiers ArrangeUs .arrus version 16 (interopérabilité en cours).
- Chargement local de musique, visualisation de forme d'onde, édition des durées fixes et des transitions, prévisualisation en pause.
- Calage manuel des transitions sur l'instant musical ; BPM pour arrondir les ajustements, sans détection automatique des temps.
- Sauvegarde dans le navigateur et export JSON. PWA installable sous HTTPS.

## Démarrage

Servir le dossier via un serveur statique HTTPS (ou localhost en développement), puis ouvrir `index.html`. Pour GitHub Pages, publier la branche `main` depuis la racine du dépôt dans les paramètres Pages (à activer manuellement si le dépôt est public).

## Utilisation de la synchronisation

1. Ouvrir un projet et charger une musique.
2. Choisir le tableau à régler, puis ouvrir « Durées et synchronisation ».
3. Déplacer le curseur sur la forme d’onde, même en pause.
4. Ajuster « Fixe » et « Trajet » par boutons, saisie ou poignées de timeline.
5. Utiliser « Fin fixe = curseur » ou « Fin trajet = curseur » pour caler le tableau.

Les blocs roses sont les placements fixes, les blocs sombres pointillés sont les transitions ; il ne s'agit pas d'espaces vides.

## État de validation

Voir [VALIDATION_NON_REGRESSION.md](VALIDATION_NON_REGRESSION.md). Les essais automatisés ont été effectués en navigateur simulé, **pas sur un téléphone physique**. Ne pas écraser les projets existants sans export JSON.

## Limites connues

- Pas encore d'export natif .arrus ni d'import/export .aubkp.
- La synchronisation du tempo est manuelle, sans reconnaissance automatique des beats.
- Les données audio sont conservées séparément du JSON et localement dans le navigateur.
- La vue 3D complète et les exports PDF avancés sont reportés.
- Le code d'import .arrus contient un secret issu de l'analyse du format ; attention si dépôt public.
