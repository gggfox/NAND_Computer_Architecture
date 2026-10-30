// expect: import/no-cycle
import { fromA } from "./a";

export const fromB = (): number => fromA() - 1;
