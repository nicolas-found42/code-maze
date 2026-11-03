# Playground animation libraries

Discovery started with the [awesome-javascript animation list](https://github.com/sorrycc/awesome-javascript#animations). Anime.js supplies the UI and Three.js object tweens; canvas-confetti supplies the finite discovery celebration. Core navigation and rendering continue when either optional effect module is unavailable.

| Local file | Package | Version | Upstream | License |
| --- | --- | --- | --- | --- |
| anime.esm.min.js | animejs | 4.5.0 | https://github.com/juliangarnier/anime | MIT, anime.LICENSE.md |
| confetti.module.mjs | canvas-confetti | 1.9.4 | https://github.com/catdad/canvas-confetti | ISC, confetti.LICENSE |

These are unmodified npm distribution files. Versions are pinned in package.json and package-lock.json. To refresh the browser copies after an intentional dependency update:

```sh
cp node_modules/animejs/dist/bundles/anime.esm.min.js docs/vendor/anime.esm.min.js
cp node_modules/animejs/LICENSE.md docs/vendor/anime.LICENSE.md
cp node_modules/canvas-confetti/dist/confetti.module.mjs docs/vendor/confetti.module.mjs
cp node_modules/canvas-confetti/LICENSE docs/vendor/confetti.LICENSE
```

The existing static build copies these files with the rest of docs. No CDN is needed. Motion preferences, live reduced-motion changes, and animation cleanup are handled in ../playground-motion.js.
