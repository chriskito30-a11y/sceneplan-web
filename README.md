# ScènePlan V4 — Interface scène prioritaire

Version du 13 novembre 2026. Prototype indépendant, non affilié à ArrangeUs.

## Modes de travail

- **Placement** (mode initial) : scène agrandie, panneau de droite fermé, barre d'outils compacte, tableaux et lecture audio visibles. Timeline détaillée repliée.
- **Synchronisation** : timeline et onde musicale affichées, édition des durées des placements et des transitions, calage manuel sur le curseur musical et réglage BPM.
- **Focus scène** : masque les panneaux et la timeline pour agrandir la zone de placement. Retour au mode précédent par le même bouton.

Sur ordinateur, les barres d'outils et de réglages sont repliables. Sur téléphone, la barre inférieure propose Outils, Réglages, Focus, Tableau et Fichiers ; le menu Fichiers regroupe import, export, projets, annuler/refaire et aide. Le cadrage de la scène s'adapte au rapport largeur/hauteur sans déformation.

## Démarrage

Servir la racine du dépôt sur HTTPS (par exemple GitHub Pages si activé). Ouvrir `index.html`. Pour travailler en local, utiliser un serveur HTTP statique. Le navigateur conserve les projets via IndexedDB lorsqu'il est autorisé. La musique est sauvegardée séparément du JSON et reste associée au navigateur.

## Compatibilité et limites

- Import/export JSON ScènePlan.
- Import expérimental ArrangeUs `.arrus` (schéma version 16 observé).
- Aucun export `.arrus`, aucun support `.aubkp` à ce stade.
- Les temps musicaux sont réglés manuellement (pas de reconnaissance automatique du rythme).
- Véritable moteur 3D et PDF avancés volontairement reportés.

## Validation et retour arrière

La **V3** est conservée sur la branche [backup/v3-2026-11-13](https://github.com/chriskito30-a11y/sceneplan-web/tree/backup/v3-2026-11-13). La V4 ne migre ni ne supprime les données enregistrées. Voir [VALIDATION_NON_REGRESSION.md](VALIDATION_NON_REGRESSION.md) avant toute nouvelle mise à jour.
