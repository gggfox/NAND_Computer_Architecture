import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { useEffect } from "react";
import type { ReactNode } from "react";

import { getLocale } from "~/i18n/locale";
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
  // The pre-rendered SPA shell is always baseLocale; correct <html lang> once the stored locale is known.
  useEffect(() => {
    document.documentElement.lang = getLocale();
  }, []);

  return (
    <html lang={getLocale()}>
      <head>
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
