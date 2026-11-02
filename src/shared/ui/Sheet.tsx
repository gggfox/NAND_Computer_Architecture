import type { ReactNode } from "react";
import { Dialog, Heading, Modal, ModalOverlay } from "react-aria-components";

import { m } from "~/i18n/paraglide/messages";

import { Button } from "./Button";

import styles from "./Sheet.module.css";

interface SheetProps {
  readonly title: string;
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly children: ReactNode;
}

function SheetHeader({
  title,
  onClose,
}: Readonly<Pick<SheetProps, "title" | "onClose">>): ReactNode {
  return (
    <div className={styles.header}>
      <Heading slot="title" className={styles.title}>
        {title}
      </Heading>
      <Button variant="quiet" onPress={onClose}>
        {m.dialog_close()}
      </Button>
    </div>
  );
}

function SheetBody({ title, onClose, children }: Readonly<Omit<SheetProps, "isOpen">>): ReactNode {
  return (
    <Dialog className={styles.dialog}>
      <SheetHeader title={title} onClose={onClose} />
      {children}
    </Dialog>
  );
}

/**
 * A modal panel that rises from the bottom edge, for phones. Focus stays inside while it is open;
 * Escape, a tap outside or its Close button calls `onClose`, and focus goes back to the opener.
 */
export function Sheet({ title, isOpen, onClose, children }: Readonly<SheetProps>): ReactNode {
  return (
    <ModalOverlay
      className={styles.overlay}
      isOpen={isOpen}
      isDismissable
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <Modal className={styles.sheet}>
        <SheetBody title={title} onClose={onClose}>
          {children}
        </SheetBody>
      </Modal>
    </ModalOverlay>
  );
}
