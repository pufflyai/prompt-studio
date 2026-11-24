import { unwrapCommandValue } from "./command-response";

export const copyCommandResult = async (
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

export const applyCommandClipboard = (input: {
  response: Promise<unknown>;
  mutating?: boolean;
  signal?: AbortSignal;
  isViewerCurrent?: () => boolean;
  reportError(error: unknown): void;
}) => {
  const { response, mutating, signal, isViewerCurrent, reportError } = input;
  const copying = copyCommandResult(response, signal, isViewerCurrent);
  if (!mutating) return Promise.all([response, copying]).then(([result]) => result);

  // A denied clipboard write must leave the server mutation pending.
  void copying.catch(async (error: unknown) => {
    try {
      unwrapCommandValue(await response);
    } catch {
      return;
    }
    if (!signal?.aborted && isViewerCurrent?.() !== false) reportError(error);
  });
  return response;
};
