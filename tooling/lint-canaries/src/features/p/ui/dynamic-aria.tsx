// expect: no-restricted-dynamic-import
export async function loadButton(): Promise<unknown> {
  const aria = await import("react-aria-components");
  return aria.Button;
}
