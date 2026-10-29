// expect: import/no-cycle
import { fromB } from "./b";

export const fromA = (): number => fromB() + 1;
