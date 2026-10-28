import { createWebviewClient, diffEditingState, type WebviewEditingSession } from "@pstdio/sdk/extensions";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { scribbleCommands } from "../scribble-commands";
import { emptyScribbleDraft, type ScribbleDraft } from "../scribble-draft";
import type { ExampleHost } from "../view-context";

const noSubscription = () => () => {};
export const useScribbleDraft = (host: ExampleHost, id: string) => {
  const [session, setSession] = useState<WebviewEditingSession<ScribbleDraft>>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    const client = createWebviewClient<typeof scribbleCommands>(host.bridge);
    let active = true;
    let opened: WebviewEditingSession<ScribbleDraft> | undefined;
    void client.editing
      .open({
        key: `scribble:draft:${id}`,
        initial: emptyScribbleDraft,
        save: { commandId: `${host.bridge.extensionId}.command.scribble.pages.save`, params: { id } },
      })
      .then((next) => {
        if (!active) return next.close();
        opened = next;
        setSession(next);
      })
      .catch((error) => setError(String(error)));
    return () => {
      active = false;
      void opened?.close();
    };
  }, [host, id]);
  const value = useSyncExternalStore(
    session?.subscribe ?? noSubscription,
    () => session?.getSnapshot().value ?? emptyScribbleDraft,
  );
  return {
    value,
    ready: Boolean(session),
    error,
    update(fields: Partial<ScribbleDraft>) {
      if (!session) return;
      const current = session.getSnapshot().value;
      void session
        .preview(diffEditingState(current, { ...current, ...fields }))
        .catch((error) => setError(String(error)));
    },
    async save() {
      if (!session) throw new Error("Draft is loading");
      const client = createWebviewClient<typeof scribbleCommands>(host.bridge);
      return client.commands["scribble.pages.save"]({
        id,
        changes: [{ path: [], value: session.getSnapshot().value }],
      });
    },
  };
};
