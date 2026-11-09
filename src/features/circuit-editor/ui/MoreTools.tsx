import { useRef, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";

import { downloadProjectFile } from "~/features/projects";
import { m } from "~/i18n/paraglide/messages";
import { MenuButton } from "~/shared/ui";

import type { EditorSession } from "../application/editor-session";
import { moreToolEntries, runMoreTool } from "./more-tools";
import { NextWireColorDialog } from "./WireDialogs";

interface MoreToolsProps {
  readonly session: EditorSession;
  readonly acceptedFileTypes: readonly string[];
  readonly onImport: (file: File) => void;
}

/**
 * The toolbar's "more" menu on a narrow screen: the wire colour, Tidy wires, Suggest wires, the
 * keyboard help, Export and Import. Import opens the file picker through a hidden file input.
 */
export function MoreTools({ session, acceptedFileTypes, onImport }: MoreToolsProps): ReactNode {
  const [wireColorOpen, setWireColorOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const handleAction = (id: string): void => {
    runMoreTool(id, {
      send: (command) => {
        session.interaction.store.getState().send({ type: "command", command });
      },
      openWireColor: () => {
        setWireColorOpen(true);
      },
      exportProject: () => {
        downloadProjectFile(session.editor.getState().history.present);
      },
      pickFile: () => {
        fileRef.current?.click();
      },
    });
  };
  const handleFile = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.item(0);
    // Cleared, so choosing the same file again reports it again.
    event.target.value = "";
    if (file !== null && file !== undefined) {
      onImport(file);
    }
  };
  return (
    <>
      <MenuButton label={m.more_tools()} entries={moreToolEntries()} onAction={handleAction} />
      <input
        ref={fileRef}
        type="file"
        accept={acceptedFileTypes.join(",")}
        hidden
        aria-hidden="true"
        tabIndex={-1}
        onChange={handleFile}
      />
      {wireColorOpen ? (
        <NextWireColorDialog
          session={session}
          onClose={() => {
            setWireColorOpen(false);
          }}
        />
      ) : undefined}
    </>
  );
}
