import { createRuntimeLoginUrl } from "../security/runtime-session";

interface WorkbenchDocument {
  loadURL(url: string): Promise<void>;
  executeJavaScript(script: string): Promise<unknown>;
  stop(): void;
}

export const prepareWorkbenchDocument = async (
  contents: WorkbenchDocument,
  runtime: Parameters<typeof createRuntimeLoginUrl>[1],
  fetcher: Parameters<typeof createRuntimeLoginUrl>[0] = fetch,
) => {
  const controller = new AbortController();
  const login = createRuntimeLoginUrl((input, init) => fetcher(input, { ...init, signal: controller.signal }), runtime);
  const navigation = contents.loadURL(`${runtime.origin}/?desktop-startup=1`);
  try {
    const [loginUrl] = await Promise.all([login, navigation]);
    await contents.executeJavaScript(`void (window.location.hash = ${JSON.stringify(new URL(loginUrl).hash)})`);
  } catch (error) {
    // Promise.all does not stop its sibling. A late navigation can abort Retry's replacement document.
    controller.abort();
    const stopped = Promise.resolve().then(() => contents.stop());
    await Promise.allSettled([login, navigation, stopped]);
    throw error;
  }
};
