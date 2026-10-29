# 10. Themes are data: design tokens shared by CSS and canvas

A theme is a named set of token values consumed by both CSS custom properties and the canvas renderer. v1 ships light, dark and high-contrast; a theme library (and possibly user themes) plugs in later. Motion respects `prefers-reduced-motion`; signal colors must stay legible in every theme.
