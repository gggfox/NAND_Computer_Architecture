import { createRootRoute, HeadContent, Outlet, Scripts, ScriptOnce } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import { registerServiceWorker, requestPersistentStorage } from "~/features/persistence";
import { themeBootScript, themes } from "~/features/theming";
import { baseLocale, getLocale } from "~/i18n/locale";
import { m } from "~/i18n/paraglide/messages";
import { flushPendingWrites } from "~/shared/pending-writes";
import { LocaleProvider, UpdateBanner } from "~/shared/ui";

import globalCss from "../styles/global.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: themes.dark.colorBackground },
      { title: m.app_title() },
    ],
    links: [
      { rel: "stylesheet", href: globalCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", href: "/icons/icon.svg", type: "image/svg+xml" },
      { rel: "apple-touch-icon", href: "/icons/icon-192.png" },
    ],
  }),
  component: RootComponent,
});

function RootComponent(): ReactNode {
  const [applyUpdate, setApplyUpdate] = useState<() => void>();

  useEffect(() => {
    // The pre-rendered SPA shell is always baseLocale; render that for hydration, then correct it.
    document.documentElement.lang = getLocale();
    // Once per app start; the browser may refuse, and the export nudge covers that (ADR 14).
    void requestPersistentStorage();
    void registerServiceWorker({
      onUpdateReady: (apply) => {
        setApplyUpdate(() => apply);
      },
      beforeReload: flushPendingWrites,
      reload: () => {
        globalThis.location.reload();
      },
    });
  }, []);

  return (
    <html lang={baseLocale}>
      <head>
        {/* Server-only: sets data-theme before first paint; renders nothing on the client. */}
        <ScriptOnce>{themeBootScript}</ScriptOnce>
        <HeadContent />
      </head>
      <body>
        <LocalizedOutlet applyUpdate={applyUpdate} />
        <Scripts />
      </body>
    </html>
  );
}

function LocalizedOutlet({
  applyUpdate,
}: {
  readonly applyUpdate: (() => void) | undefined;
}): ReactNode {
  return (
    <LocaleProvider locale={getLocale()}>
      <UpdateBanner onReload={applyUpdate} />
      <Outlet />
    </LocaleProvider>
  );
}
