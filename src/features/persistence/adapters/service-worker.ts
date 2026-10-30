/** Registers the offline service worker (ADR 7). Production builds only; never rejects. */
export const registerServiceWorker = async (): Promise<boolean> => {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) {
    return false;
  }
  try {
    await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    return true;
  } catch {
    return false;
  }
};
