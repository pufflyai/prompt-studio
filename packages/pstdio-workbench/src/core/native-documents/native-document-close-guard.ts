/** A browser frame is not saved until its local host acknowledges it. */
export const registerNativeDocumentCloseGuard = (pending: () => boolean, flush: () => Promise<void>) => {
  if (typeof window === "undefined") return () => {};
  const beforeUnload = (event: BeforeUnloadEvent) => {
    if (!pending()) return;
    void flush().catch(() => {});
    event.preventDefault();
    event.returnValue = "";
  };
  window.addEventListener("beforeunload", beforeUnload);
  return () => window.removeEventListener("beforeunload", beforeUnload);
};
