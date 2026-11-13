# ScènePlan V4.1 — placement libre et sélection stable

ScènePlan est un prototype indépendant de placement scénique pour ordinateur et téléphone, non affilié à ArrangeUs.

## Correctifs du 13 novembre 2026

- **Cadrage stable :** un clic ou un appui sur un artiste ne redimensionne plus la scène. La barre d'actions sélection est désormais superposée.
- **Libre par défaut :** les artistes peuvent se placer entre les lignes du quadrillage ; aucune position n'est automatiquement arrondie au relâchement.
- **Aimantation facultative :** bouton **◌ Libre / ⌗ Aimant** toujours accessible en haut de la scène. L'attraction ne s'exerce qu'à proximité d'un repère (au plus 8 pixels et 20 % d'une case). Un mouvement au-delà reste libre.
- **Groupes :** une correction commune préserve l'espacement entre artistes sélectionnés.
- **Anciens projets :** passage en mode Libre à l'ouverture sans changement des positions enregistrées ; la préférence Aimant peut ensuite être activée et sauvegardée.
- Le panneau **Scène** conserve le même réglage d'aide magnétique.

## Fonctionnalités conservées

Modes Placement / Synchronisation / Focus, zoom tactile, déplacements, modèles de placement, accessoires, formations et transitions, lecture audio et timeline, annuler/refaire, sauvegarde locale et export JSON, import expérimental de fichiers .arrus v16.

La V3 reste dans `backup/v3-2026-11-13` et la V4 précédente dans `backup/v4-2026-11-13`.

## Utilisation

Servir la racine de ce dépôt en HTTPS (GitHub Pages si activé). Les projets et musiques sont enregistrés localement dans le navigateur. Exporter régulièrement les projets en JSON.

La 3D avancée, les PDF avancés, l'export .arrus et la sauvegarde .aubkp ne sont pas encore implémentés. Voir le [rapport de non-régression](VALIDATION_NON_REGRESSION.md).
