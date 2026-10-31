# StPageFlip / page-flip 2.0.7

Upstream: https://github.com/Nodlik/StPageFlip (MIT, Copyright 2020 Nodlik).
Package: https://registry.npmjs.org/page-flip/-/page-flip-2.0.7.tgz
Verified npm SHA-512: `96lQFUUz7r/LZzEUZJ3yBIMEKU9+m8HMFDzTvTdD6P7Ag/wXINjp9n0W7b4wanwnDbQETo4uNUoL3zMqpFxwGA==`.

`page-flip.mjs` is the upstream `dist/js/page-flip.module.js`, with these local fixes:

- Render.start stores its animation frame; Render.stop cancels it. PageFlip.destroy calls stop before removing the DOM.
- UI.destroy always calls removeHandlers, so its resize listener is removed even with useMouseEvents:false.
- Temporary portrait copies are inert, aria-hidden, and omit IDs, so they remain decorative without duplicate SVG IDs.

These changes support switching between desktop and single-page readers without retained listeners or render loops. The original MIT license is in LICENSE.txt and must accompany redistribution, including the commercial template.
