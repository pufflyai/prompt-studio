import { unwrapCommandValue } from "./command-response";

export const copyCommandResult = (
  response: Promise<unknown>,
  signal?: AbortSignal,
  isViewerCurrent?: () => boolean,
) => {
  const text = response.then((result) => {
    signal?.throwIfAborted();
    if (isViewerCurrent?.() === false) throw new Error("The command's viewer is closed.");
    const value = unwrapCommandValue(result);
    if (typeof value !== "string") throw new Error("Copy to clipboard requires a text result.");
    return new Blob([value], { type: "text/plain" });
  });
  // Observe result failures even when the browser refuses the clipboard request immediately.
  void text.catch(() => {});
  const writing = navigator.clipboard.write([new ClipboardItem({ "text/plain": text })]);
  return Promise.all([text, writing]).then(() => {});
};
