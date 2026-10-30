import { createRootRoute, HeadContent, Outlet, Scripts, ScriptOnce } from "@tanstack/react-router";
import { useEffect } from "react";
import type { ReactNode } from "react";

import { requestPersistentStorage } from "~/features/persistence";
import { themeBootScript } from "~/features/theming";
import { baseLocale, getLocale } from "~/i18n/locale";
import { m } from "~/i18n/paraglide/messages";
import { LocaleProvider } from "~/shared/ui";

import globalCss from "../styles/global.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: m.app_title() },
    ],
    links: [{ rel: "stylesheet", href: globalCss }],
  }),
  component: RootComponent,
});

function RootComponent(): ReactNode {
  useEffect(() => {
    // The pre-rendered SPA shell is always baseLocale; render that for hydration, then correct it.
    document.documentElement.lang = getLocale();
    // Once per app start; the browser may refuse, and the export nudge covers that (ADR 14).
    void requestPersistentStorage();
  }, []);

  return (
    <html lang={baseLocale}>
      <head>
        {/* Server-only: sets data-theme before first paint; renders nothing on the client. */}
        <ScriptOnce>{themeBootScript}</ScriptOnce>
        <HeadContent />
      </head>
      <body>
        <LocalizedOutlet />
        <Scripts />
      </body>
    </html>
  );
}

function LocalizedOutlet(): ReactNode {
  return (
    <LocaleProvider locale={getLocale()}>
      <Outlet />
    </LocaleProvider>
  );
}
