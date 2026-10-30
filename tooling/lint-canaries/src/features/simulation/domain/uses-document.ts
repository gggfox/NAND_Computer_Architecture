// expect: no-restricted-globals
export function pageTitle(): string {
  return document.title;
}
