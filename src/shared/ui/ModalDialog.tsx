import type { ReactNode } from "react";
import { Dialog, Heading, Modal, ModalOverlay } from "react-aria-components";

import styles from "./ModalDialog.module.css";

interface ModalDialogProps {
  readonly title: string;
  readonly children: ReactNode;
  readonly onClose: () => void;
}

function DialogBody({ title, children }: Readonly<Omit<ModalDialogProps, "onClose">>): ReactNode {
  return (
    <Dialog className={styles.dialog}>
      <Heading slot="title" className={styles.title}>
        {title}
      </Heading>
      {children}
    </Dialog>
  );
}

/** A modal dialog, open while rendered. Escape or a press outside calls `onClose`. */
export function ModalDialog({ title, children, onClose }: Readonly<ModalDialogProps>): ReactNode {
  return (
    <ModalOverlay
      className={styles.overlay}
      isOpen
      isDismissable
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onClose();
        }
      }}
    >
      <Modal className={styles.modal}>
        <DialogBody title={title}>{children}</DialogBody>
      </Modal>
    </ModalOverlay>
  );
}
