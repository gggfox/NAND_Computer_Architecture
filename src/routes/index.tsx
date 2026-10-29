import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { m } from "~/i18n/paraglide/messages";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home(): ReactNode {
  return (
    <main>
      <h1>{m.app_title()}</h1>
    </main>
  );
}
