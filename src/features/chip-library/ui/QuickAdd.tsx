import { useState } from "react";
import type { ReactNode } from "react";
import { useStore } from "zustand";

import { useRecentPlacements } from "~/features/circuit-editor";
import type { CanvasMenuContext, EditorSession } from "~/features/circuit-editor";
import { m } from "~/i18n/paraglide/messages";
import { PointPopover, SearchList } from "~/shared/ui";

import { quickAddView } from "./quick-add-view";
import type { QuickAddPick } from "./quick-add-view";

const pickIn = (context: CanvasMenuContext, pick: QuickAddPick): void => {
  if (pick.type === "place") {
    context.place(pick.kind);
  } else if (pick.type === "pin") {
    context.addPin(pick.direction);
  } else {
    context.tidyWires();
  }
};

/**
 * The canvas's quick-add menu at the press point (D9): search the library, or pick from Recent,
 * Starred, the pins, the built-ins and Tidy wires. Each pick acts at the point and closes the menu.
 */
export function QuickAdd({
  session,
  context,
}: {
  readonly session: EditorSession;
  readonly context: CanvasMenuContext;
}): ReactNode {
  const [query, setQuery] = useState("");
  const project = useStore(session.editor, (editor) => editor.history.present);
  const openChipId = useStore(session.editor, (editor) => editor.chipId);
  const recent = useRecentPlacements(session);
  const view = quickAddView({ project, openChipId, recent }, query);
  return (
    <PointPopover
      label={m.quick_add_label()}
      point={context.screen}
      onClose={() => {
        context.close();
      }}
    >
      <SearchList
        label={m.quick_add_label()}
        searchLabel={m.quick_add_search()}
        query={query}
        onQueryChange={setQuery}
        sections={view.sections}
        onAction={(id) => {
          const pick = view.picks.get(id);
          if (pick !== undefined) {
            pickIn(context, pick);
          }
        }}
      />
    </PointPopover>
  );
}
