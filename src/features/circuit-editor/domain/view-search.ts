/* oxlint-disable promise/prefer-await-to-then, unicorn/prefer-top-level-await -- Zod's .catch() is a schema fallback, not Promise.catch */
/* oxlint-disable eslint/id-length -- `x` and `y` are the public URL search param names */
import { z } from "zod";

import { ChipIdSchema } from "~/shared/ids";

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;

export const EditorSearchSchema = z.object({
  // oxlint-disable-next-line unicorn/no-useless-undefined -- Zod .catch() needs an explicit fallback value
  chip: ChipIdSchema.optional().catch(undefined),
  zoom: z.number().min(MIN_ZOOM).max(MAX_ZOOM).catch(1).default(1),
  x: z.number().catch(0).default(0),
  y: z.number().catch(0).default(0),
});

export type EditorSearch = z.output<typeof EditorSearchSchema>;
