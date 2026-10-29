/* Writes src/features/theming/tokens.css from the theme data. Run with `pnpm tokens`. */
import { writeFileSync } from "node:fs";
import path from "node:path";

import { renderThemeCss, themes } from "../src/features/theming/domain/themes.ts";

const OUTPUT = path.resolve(import.meta.dirname, "..", "src", "features", "theming", "tokens.css");

writeFileSync(OUTPUT, renderThemeCss(themes));
