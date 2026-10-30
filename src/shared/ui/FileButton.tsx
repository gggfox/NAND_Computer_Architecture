import type { ReactNode } from "react";
import { FileTrigger } from "react-aria-components";

import { Button } from "./Button";

interface FileButtonProps {
  readonly children: ReactNode;
  readonly acceptedFileTypes: readonly string[];
  readonly onSelect: (file: File) => void;
  readonly variant?: "primary" | "quiet" | undefined;
}

/** A button that opens the file picker and reports the first chosen file. */
export function FileButton({
  children,
  acceptedFileTypes,
  onSelect,
  variant = "primary",
}: Readonly<FileButtonProps>): ReactNode {
  return (
    <FileTrigger
      acceptedFileTypes={acceptedFileTypes}
      onSelect={(files) => {
        const file = files?.item(0);
        if (file !== null && file !== undefined) {
          onSelect(file);
        }
      }}
    >
      <Button variant={variant}>{children}</Button>
    </FileTrigger>
  );
}
