import type { GuestHost } from "./guest-host";
import type { TextEditingClient } from "./text-editing-types";

/** Text/Yjs code loads only when an editor requests a text session. */
export const createTextEditingClient = (host: GuestHost, loadSession = () => import("./text-editing-session")) =>
  ({
    current: () => host.call("editing.text", { operation: "current" }),
    open: async (input) => {
      const memberId = crypto.randomUUID();
      const early: unknown[] = [];
      const listeners = new Set<(value: unknown) => void>();
      const stop = host.onEvent("editing.text", (value) => {
        if (!listeners.size) early.push(value);
        else for (const listener of listeners) listener(value);
      });
      const buffered: GuestHost = {
        ...host,
        call: host.call.bind(host),
        onEvent(scope, listener) {
          if (scope !== "editing.text") return host.onEvent(scope, listener);
          listeners.add(listener);
          for (const event of early.splice(0)) listener(event);
          return () => {
            listeners.delete(listener);
            if (!listeners.size) stop();
          };
        },
      };
      try {
        // Both belong to this admitted open. Observe either rejection immediately,
        // and drain registration before cleanup so a late ACK cannot leak a member.
        const [registered, module] = await Promise.allSettled([
          Promise.resolve().then(() => host.call("editing.text", { operation: "register", memberId })),
          Promise.resolve().then(loadSession),
        ]);
        if (registered.status === "rejected") throw registered.reason;
        if (module.status === "rejected") throw module.reason;
        return await module.value.openTextEditingSession(buffered, input, memberId);
      } catch (error) {
        stop();
        await host.call("editing.text", { operation: "abandon", memberId }).catch(() => {});
        throw error;
      }
    },
  }) satisfies TextEditingClient;
