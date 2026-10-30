// expect: no-restricted-dynamic-import
export async function loadReact(): Promise<unknown> {
  const react = await import(`react`);
  return react.useState;
}
