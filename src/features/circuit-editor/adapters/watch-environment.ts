/**
 * Calls `onChange` on element resize and device-pixel-ratio change, and `onTheme` when <html>'s
 * `data-theme` changes. Returns the function that stops watching.
 */
export const watchEnvironment = (
  canvas: HTMLCanvasElement,
  onChange: () => void,
  onTheme: () => void,
): (() => void) => {
  const themeObserver = new MutationObserver(onTheme);
  themeObserver.observe(document.documentElement, { attributeFilter: ["data-theme"] });
  const resizeObserver = new ResizeObserver(onChange);
  resizeObserver.observe(canvas);
  // A query for the current ratio fires once when the ratio changes (browser zoom, another screen).
  let ratioQuery: MediaQueryList | undefined = undefined;
  const watchRatio = (): void => {
    ratioQuery?.removeEventListener("change", onRatio);
    ratioQuery = matchMedia(`(resolution: ${String(globalThis.devicePixelRatio || 1)}dppx)`);
    ratioQuery.addEventListener("change", onRatio);
  };
  function onRatio(): void {
    watchRatio();
    onChange();
  }
  watchRatio();
  return () => {
    themeObserver.disconnect();
    resizeObserver.disconnect();
    ratioQuery?.removeEventListener("change", onRatio);
  };
};
