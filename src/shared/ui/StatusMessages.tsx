import type { ReactNode } from "react";

import styles from "./StatusMessages.module.css";

interface StatusMessagesProps {
  readonly messages: readonly string[];
}

/**
 * A polite live region (`<output>` has the implicit `status` role) that is always mounted, so
 * messages added later are announced. Each message renders on its own line.
 */
export function StatusMessages({ messages }: StatusMessagesProps): ReactNode {
  return (
    <output className={styles.status}>
      {messages.map((message) => (
        <span key={message} className={styles.message}>
          {message}
        </span>
      ))}
    </output>
  );
}
