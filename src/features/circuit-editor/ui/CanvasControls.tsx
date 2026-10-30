import type { ReactNode } from "react";
import { useStore } from "zustand";

import { m } from "~/i18n/paraglide/messages";
import { Button, SegmentedControl } from "~/shared/ui";

import type { EditorSession } from "../application/editor-session";
import type { InteractionCommand } from "../domain/interaction";
import { isEmpty } from "../domain/selection";
import { WireColorButton } from "./WireDialogs";

/** Pan or Select for a one-finger drag on empty canvas (spec §5.3). */
export function ToolSwitch({ session }: { readonly session: EditorSession }): ReactNode {
  const tool = useStore(session.interaction.store, (state) => state.tool);
  return (
    <SegmentedControl
      label={m.tool_switch_label()}
      options={[
        { id: "pan", label: m.tool_pan() },
        { id: "select", label: m.tool_select() },
      ]}
      value={tool}
      onChange={(id) => {
        session.interaction.store.getState().send({
          type: "command",
          command: { type: "setTool", tool: id === "pan" ? "pan" : "select" },
        });
      }}
    />
  );
}

/**
 * Delete, the next wire colour, Tidy wires, zoom, fit and the keyboard help: the toolbar twins of
 * the canvas keys and menus.
 */
export function CanvasButtons({ session }: { readonly session: EditorSession }): ReactNode {
  const nothingSelected = useStore(session.interaction.store, (state) => isEmpty(state.selection));
  const run = (command: InteractionCommand) => (): void => {
    session.interaction.store.getState().send({ type: "command", command });
  };
  return (
    <>
      <Button
        isDisabled={nothingSelected}
        onPress={run({ type: "deleteSelection" })}
        variant="quiet"
      >
        {m.delete_selection()}
      </Button>
      <WireColorButton session={session} />
      <Button onPress={run({ type: "tidyWires" })} variant="quiet">
        {m.tidy_wires()}
      </Button>
      <Button onPress={run({ type: "zoomOut" })} variant="quiet">
        {m.zoom_out()}
      </Button>
      <Button onPress={run({ type: "zoomIn" })} variant="quiet">
        {m.zoom_in()}
      </Button>
      <Button onPress={run({ type: "fit" })} variant="quiet">
        {m.zoom_fit()}
      </Button>
      <Button onPress={run({ type: "showHelp" })} variant="quiet">
        {m.keyboard_shortcuts()}
      </Button>
    </>
  );
}
