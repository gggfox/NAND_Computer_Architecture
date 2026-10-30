// expect: react/jsx-no-literals
import type { ReactNode } from "react";

export function Greeting(): ReactNode {
  return <p>Hello, circuit builder</p>;
}
