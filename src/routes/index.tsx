import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home(): ReactNode {
  return (
    <main>
      <h1>NAND Computer Architecture</h1>
    </main>
  );
}
