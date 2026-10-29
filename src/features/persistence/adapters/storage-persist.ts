/** Asks the browser not to evict our data under storage pressure. Never rejects. */
export const requestPersistentStorage = async (): Promise<boolean> => {
  try {
    // `storage` is missing in older and insecure-context browsers despite the DOM typings.
    return (await navigator.storage?.persist()) ?? false;
  } catch {
    return false;
  }
};
