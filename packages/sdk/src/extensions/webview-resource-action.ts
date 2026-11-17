import type { ResourceRef, WebviewResourceActionChoice } from "pstdio-api-contracts/extension-kernel";
import type { GuestHost } from "./guest-host";

/** Adds a current-reader action to its native resource menus. Requires resources.actions.register.
 * The host binds it to this exact view, resource and project; it disappears on disposal/disconnect.
 */
export const registerWebviewResourceAction = (
  host: GuestHost,
  action: { resource: ResourceRef; label: string; icon?: string; choices?: readonly WebviewResourceActionChoice[] },
  run: (signal: AbortSignal, choiceId?: string) => Promise<void>,
) => {
  const registrationId = crypto.randomUUID();
  const pending = new Map<string, AbortController>();
  let disposed = false;
  const stop = host.onEvent("resources.actions.invoke", (payload) => {
    const event = payload as { type: string; registrationId: string; requestId: string; choiceId?: string };
    if (event.registrationId !== registrationId || disposed) return;
    if (event.type === "cancel") {
      pending.get(event.requestId)?.abort();
      return;
    }
    if (event.type !== "execute" || pending.has(event.requestId)) return;
    const controller = new AbortController();
    pending.set(event.requestId, controller);
    void Promise.resolve()
      .then(() => {
        controller.signal.throwIfAborted();
        return run(controller.signal, event.choiceId);
      })
      .then(
        () => undefined,
        (error) => String(error instanceof Error ? error.message : error).slice(0, 2000) || "Resource action failed.",
      )
      .then(async (error) => {
        pending.delete(event.requestId);
        if (!disposed)
          await host.call("resources.actions.register", { operation: "complete", requestId: event.requestId, error });
      })
      .catch(() => {});
  });
  const ready = host.call("resources.actions.register", {
    operation: "register",
    registrationId,
    ...action,
    resource: { ...action.resource },
  });
  return {
    ready,
    /** Refresh up to 1024 choices without interrupting an accepted selection. */
    async updateChoices(choices: readonly WebviewResourceActionChoice[], options?: { label?: string }) {
      if (disposed) return;
      await ready;
      if (!disposed)
        await host.call("resources.actions.register", {
          operation: "update-choices",
          registrationId,
          choices,
          ...options,
        });
    },
    async dispose() {
      if (disposed) return;
      disposed = true;
      stop();
      for (const controller of pending.values()) controller.abort();
      pending.clear();
      try {
        await ready;
      } catch {
        return;
      }
      await host.call("resources.actions.register", { operation: "unregister", registrationId });
    },
  };
};
