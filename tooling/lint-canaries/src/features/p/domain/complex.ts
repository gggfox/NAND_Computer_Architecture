// expect: sonarjs/cognitive-complexity
export function classify(values: readonly number[], flag: boolean, mode: string): number {
  let total = 0;
  for (const value of values) {
    if (value > 0) {
      if (flag) {
        if (mode === "a") {
          total += value;
        } else if (mode === "b") {
          total -= value;
        } else {
          for (let index = 0; index < value; index += 1) {
            if (index % 2 === 0 && flag) {
              total += index;
            } else if (index % 3 === 0 || mode === "c") {
              total -= index;
            }
          }
        }
      } else if (value > 10) {
        total *= 2;
      }
    } else {
      while (total > 100) {
        total -= 1;
      }
    }
  }
  return total;
}
