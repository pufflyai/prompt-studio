import { PstdioApiError, type RequestFn } from "./request";

// A live shared connection still owns server subscriptions after a failed DELETE.
// Retry removal without interrupting other sessions or command streams.
export const removeSessionStreamSubscription = async (request: RequestFn, path: string, signal: AbortSignal) => {
  while (!signal.aborted) {
    try {
      await request(path, { method: "DELETE", signal });
      return;
    } catch (error) {
      if (signal.aborted || (error instanceof PstdioApiError && error.status === 404)) return;
      await new Promise<void>((resolve) => {
        const finish = () => {
          clearTimeout(timer);
          signal.removeEventListener("abort", finish);
          resolve();
        };
        const timer = setTimeout(finish, 1000);
        signal.addEventListener("abort", finish, { once: true });
      });
    }
  }
};
