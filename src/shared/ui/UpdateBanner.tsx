import type { ReactNode } from "react";

import { m } from "~/i18n/paraglide/messages";

import { Button } from "./Button";

import styles from "./UpdateBanner.module.css";

interface UpdateBannerProps {
  /** Present while a new version waits; pressing the button applies it (the page then reloads). */
  readonly onReload: (() => void) | undefined;
}

/** A polite live region that offers a waiting app update; renders an empty region otherwise. */
export function UpdateBanner({ onReload }: UpdateBannerProps): ReactNode {
  return (
    <output>
      {onReload === undefined ? undefined : (
        <span className={styles.banner}>
          <span>{m.update_ready()}</span>
          <Button onPress={onReload}>{m.update_reload()}</Button>
        </span>
      )}
    </output>
  );
}
