import { useState } from "react";
import type { ReactNode } from "react";
import { useStore } from "zustand";

import { WIRE_COLORS } from "~/features/projects";
import type { WireColor } from "~/features/projects";
import { m } from "~/i18n/paraglide/messages";
import { Button, ModalDialog, SwatchPicker } from "~/shared/ui";
import type { Swatch } from "~/shared/ui";

import type { EditorSession } from "../application/editor-session";
import { DialogActions, DialogForm } from "./ChipDialogs";

import styles from "./WireDialogs.module.css";

/** A default wire is drawn in the signal colours, so its swatch shows the "on" one. */
const DEFAULT_SWATCH = "var(--color-signal-high)";

const NAMES: Readonly<Record<WireColor, () => string>> = {
  blue: m.color_blue,
  red: m.color_red,
  orange: m.color_orange,
  yellow: m.color_yellow,
  green: m.color_green,
  teal: m.color_teal,
  purple: m.color_purple,
  pink: m.color_pink,
};

/**
 * The swatch value of a wire colour. A CSS `var()` rather than a computed hex: the picker paints
 * it as a background, it follows a theme change while open, and every key stays a distinct value
 * even when two themes' tokens coincide.
 */
const swatchOf = (color: WireColor | undefined): string =>
  color === undefined ? DEFAULT_SWATCH : `var(--color-wire-${color})`;

const colorOf = (swatch: string): WireColor | undefined =>
  WIRE_COLORS.find((color) => swatchOf(color) === swatch);

const nameOf = (color: WireColor | undefined): string =>
  color === undefined ? m.color_default() : NAMES[color]();

const swatches = (): readonly Swatch[] => [
  { color: DEFAULT_SWATCH, label: m.color_default() },
  ...WIRE_COLORS.map((color) => ({ color: swatchOf(color), label: NAMES[color]() })),
];

interface WireColorDialogProps {
  readonly title: string;
  readonly color: WireColor | undefined;
  /** No colour is the default. */
  readonly onSave: (color: WireColor | undefined) => void;
  readonly onClose: () => void;
}

/** Picks a wire colour, or the default; each swatch is named, so colour is never the only cue. */
export function WireColorDialog({
  title,
  color,
  onSave,
  onClose,
}: WireColorDialogProps): ReactNode {
  const [value, setValue] = useState(swatchOf(color));
  return (
    <ModalDialog title={title} onClose={onClose}>
      <DialogForm
        onSubmit={() => {
          onSave(colorOf(value));
        }}
      >
        <SwatchPicker
          label={m.wire_color_label()}
          swatches={swatches()}
          value={value}
          onChange={setValue}
        />
        <DialogActions onClose={onClose} />
      </DialogForm>
    </ModalDialog>
  );
}

function ColorLabel({ color }: { readonly color: WireColor | undefined }): ReactNode {
  return (
    <span className={styles.label}>
      <span
        className={styles.dot}
        style={{ backgroundColor: swatchOf(color) }}
        aria-hidden="true"
      />
      {m.wire_color_button({ color: nameOf(color) })}
    </span>
  );
}

/** The toolbar's next-wire colour: shows the current swatch and opens the picker to change it. */
export function WireColorButton({ session }: { readonly session: EditorSession }): ReactNode {
  const color = useStore(session.interaction.store, (state) => state.wireColor);
  const [open, setOpen] = useState(false);
  const close = (): void => {
    setOpen(false);
  };
  return (
    <>
      <Button
        variant="quiet"
        onPress={() => {
          setOpen(true);
        }}
      >
        <ColorLabel color={color} />
      </Button>
      {open ? (
        <WireColorDialog
          title={m.next_wire_color_title()}
          color={color}
          onClose={close}
          onSave={(next) => {
            session.interaction.store.getState().send({
              type: "command",
              command: { type: "setWireColor", ...(next === undefined ? {} : { color: next }) },
            });
            close();
          }}
        />
      ) : undefined}
    </>
  );
}
