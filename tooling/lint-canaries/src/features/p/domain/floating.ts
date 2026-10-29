// expect: typescript/no-floating-promises
async function save(): Promise<void> {
  await Promise.resolve();
}

export function onClick(): void {
  save();
}
