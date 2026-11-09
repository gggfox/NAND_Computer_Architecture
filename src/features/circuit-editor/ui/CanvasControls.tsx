import type { ReactNode } from "react";
import { useStore } from "zustand";

import { m } from "~/i18n/paraglide/messages";
import { Button, SegmentedControl } from "~/shared/ui";

import type { EditorSession } from "../application/editor-session";
import type { InteractionCommand } from "../domain/interaction";
import { isEmpty } from "../domain/selection";
import { CompactLabel } from "./CompactLabel";
import { PanIcon, SelectIcon } from "./icons";
import { WireColorButton } from "./WireDialogs";

/** Pan or Select for a one-finger drag on empty canvas (spec §5.3). */
export function ToolSwitch({ session }: { readonly session: EditorSession }): ReactNode {
  const tool = useStore(session.interaction.store, (state) => state.tool);
  return (
    <SegmentedControl
      label={m.tool_switch_label()}
      options={[
        { id: "pan", label: <CompactLabel label={m.tool_pan()} short={<PanIcon />} /> },
        {
          id: "select",
          label: <CompactLabel label={m.tool_select()} short={<SelectIcon />} />,
        },
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

type Run = (command: InteractionCommand) => () => void;

const runner =
  (session: EditorSession): Run =>
  (command) =>
  (): void => {
    session.interaction.store.getState().send({ type: "command", command });
  };

/** Deletes the selection; disabled while nothing is selected. */
export function DeleteButton({ session }: { readonly session: EditorSession }): ReactNode {
  const nothingSelected = useStore(session.interaction.store, (state) => isEmpty(state.selection));
  return (
    <Button
      isDisabled={nothingSelected}
      onPress={runner(session)({ type: "deleteSelection" })}
      variant="quiet"
    >
      {m.delete_selection()}
    </Button>
  );
}

/** Zoom out, zoom in and fit: the twins of the `-`, `+` and `0` keys. */
export function ZoomButtons({ session }: { readonly session: EditorSession }): ReactNode {
  const run = runner(session);
  return (
    <>
      <Button onPress={run({ type: "zoomOut" })} variant="quiet">
        {m.zoom_out()}
      </Button>
      <Button onPress={run({ type: "zoomIn" })} variant="quiet">
        {m.zoom_in()}
      </Button>
      <Button onPress={run({ type: "fit" })} variant="quiet">
        {m.zoom_fit()}
      </Button>
    </>
  );
}

/**
 * The next wire colour, Tidy wires, Suggest wires, zoom, fit and the keyboard help: the toolbar
 * twins of the canvas keys and menus on a wide screen.
 */
export function CanvasButtons({ session }: { readonly session: EditorSession }): ReactNode {
  const run = runner(session);
  return (
    <>
      <WireColorButton session={session} />
      <Button onPress={run({ type: "tidyWires" })} variant="quiet">
        {m.tidy_wires()}
      </Button>
      <Button onPress={run({ type: "suggestWires" })} variant="quiet">
        {m.suggest_wires()}
      </Button>
      <ZoomButtons session={session} />
      <Button onPress={run({ type: "showHelp" })} variant="quiet">
        {m.keyboard_shortcuts()}
      </Button>
    </>
  );
}
