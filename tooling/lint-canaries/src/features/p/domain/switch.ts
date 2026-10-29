// expect: typescript/switch-exhaustiveness-check
type Gate = "nand" | "input" | "output";

export function label(gate: Gate): string {
  switch (gate) {
    case "nand": {
      return "N";
    }
    case "input": {
      return "I";
    }
    default: {
      return "?";
    }
  }
}
