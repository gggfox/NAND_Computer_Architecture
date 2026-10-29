# 23. Feature-folder structure with enforced boundaries

`src/features/<feature>/` with a single public `index.ts` per feature; `src/shared/` for tiny cross-cutting utilities only; thin `src/routes/`; `src/i18n/`; later `convex/<aggregate>/`. Rules: features never import another feature's internals; `simulation` imports no React/DOM; `shared` imports no feature. Initial features: simulation, circuit-editor, chip-library, projects, persistence, sharing, theming, accessibility.
