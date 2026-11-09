import { m } from "~/i18n/paraglide/messages";
import type { MenuEntry } from "~/shared/ui";

import type { InteractionCommand } from "../domain/interaction";

/** What the toolbar's "more" menu holds on a narrow screen, in menu order. */
const MORE_TOOLS = [
  "wireColor",
  "tidyWires",
  "suggestWires",
  "showHelp",
  "export",
  "import",
] as const;

type MoreTool = (typeof MORE_TOOLS)[number];

const LABELS: Readonly<Record<MoreTool, () => string>> = {
  wireColor: m.next_wire_color_title,
  tidyWires: m.tidy_wires,
  suggestWires: m.suggest_wires,
  showHelp: m.keyboard_shortcuts,
  export: m.export,
  import: m.import,
};

/** The menu's entries, labelled in the current language. */
export const moreToolEntries = (): readonly MenuEntry[] =>
  MORE_TOOLS.map((tool) => ({ id: tool, label: LABELS[tool]() }));

/** What a "more" menu entry does, outside the canvas commands. */
export interface MoreToolHandlers {
  readonly send: (command: InteractionCommand) => void;
  readonly openWireColor: () => void;
  readonly exportProject: () => void;
  readonly pickFile: () => void;
}

const actionOf = (id: string, handlers: MoreToolHandlers): (() => void) | undefined => {
  switch (id) {
    case "wireColor": {
      return handlers.openWireColor;
    }
    case "tidyWires":
    case "suggestWires":
    case "showHelp": {
      return () => {
        handlers.send({ type: id });
      };
    }
    case "export": {
      return handlers.exportProject;
    }
    case "import": {
      return handlers.pickFile;
    }
    default: {
      return undefined;
    }
  }
};

/** Runs the entry with id `id`; an unknown id does nothing. */
export const runMoreTool = (id: string, handlers: MoreToolHandlers): void => {
  actionOf(id, handlers)?.();
};
