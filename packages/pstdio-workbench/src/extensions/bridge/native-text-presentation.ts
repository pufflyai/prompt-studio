import { createTextEditingClient, type TextEditingSession } from "@pstdio/sdk/extensions";
import { createHostCapabilityGate } from "pstdio-extensions/bridge/contract";
import { createGuestHost } from "pstdio-extensions/bridge/guest";
import { capabilityReply, createHostEventPublisher } from "pstdio-extensions/bridge/host";
import { releasePlacementTextGuest } from "../../core/text-editing/placement-text-guests";
import { createWorkbenchWebviewHostCapabilities } from "./webview-host-capabilities";
import type { WorkbenchTextEditingInput } from "./webview-text-editing";

type NativeTextPresentationInput = Required<
  Pick<WorkbenchTextEditingInput, "workbench" | "placement" | "projectId" | "textTarget" | "textEditing">
>;

/** Native Markdown is a public guest with the same selected-source dispatcher as an installed editor. */
export const createNativeTextPresentation = (input: NativeTextPresentationInput) => {
  const lifetime = new AbortController();
  const events = createHostEventPublisher();
  const listeners = new Map<string, Set<(event: unknown) => void>>();
  let opening: Promise<TextEditingSession> | undefined;
  let retrying: Promise<TextEditingSession> | undefined;
  let closing: Promise<void> | undefined;
  const closed = () =>
    Object.assign(new Error("This text view is no longer open"), {
      code: "session_closed",
      retryable: false,
    });
  const prepareSessionClose = () => {
    closing ??= Promise.resolve()
      .then(async () => {
        // Failed admission has no local session. The enclosing guest still owns its admitted member cleanup.
        const session = await opening?.catch(() => undefined);
        if (session) await session.close();
        else await retrying?.catch(() => undefined);
      })
      .catch((error) => {
        closing = undefined;
        throw error;
      });
    return closing;
  };
  const gate = createHostCapabilityGate({
    capabilities: createWorkbenchWebviewHostCapabilities({ ...input, hostEvents: events, prepareSessionClose }),
    declaredCapabilities: ["editing.text"],
  });
  const host = createGuestHost(
    (request) =>
      capabilityReply(() => {
        if (lifetime.signal.aborted) throw closed();
        return gate.call(request);
      }),
    (scope, listener) => {
      let scoped = listeners.get(scope);
      if (!scoped) {
        scoped = new Set();
        listeners.set(scope, scoped);
      }
      scoped.add(listener);
      return () => {
        scoped.delete(listener);
      };
    },
  );
  events.bind((message) => {
    for (const listener of listeners.get(message.scope) ?? []) listener(message.payload);
  });
  const client = createTextEditingClient(host);
  const admit = async () => {
    const grant = await client.current();
    if (!grant) throw new Error("The selected file does not declare a text source");
    return client.open({ grant });
  };
  const open = () => {
    if (lifetime.signal.aborted || closing) return Promise.reject(closed());
    opening ??= Promise.resolve().then(admit);
    return opening;
  };
  return {
    open,
    retry() {
      if (lifetime.signal.aborted || closing) return Promise.reject(closed());
      if (!opening) return open();
      retrying ??= opening
        .then(
          async (session) => {
            await session.retry();
            return session;
          },
          async () => {
            await releasePlacementTextGuest(input.workbench, events);
            if (lifetime.signal.aborted || closing) throw closed();
            opening = Promise.resolve().then(admit);
            return opening;
          },
        )
        .finally(() => {
          retrying = undefined;
        });
      return retrying;
    },
    async close() {
      await prepareSessionClose();
      lifetime.abort();
      events.unbind();
      listeners.clear();
    },
  };
};

export type NativeTextPresentation = ReturnType<typeof createNativeTextPresentation>;
