import { useEffect, useRef, useState } from "react";
import type { BookClient } from "./client";
import type { BookData } from "./read";
import { changed, type Draft } from "./records";
export function useBook(client: BookClient) {
  const [data, setData] = useState<BookData>();
  const workspace = useRef<string>(undefined);
  const [query, setQuery] = useState({ revision: "working" as const });
  const refresh = () => setQuery((current) => ({ ...current }));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => client.events.subscribe(changed, () => setQuery((current) => ({ ...current }))), [client]);
  useEffect(() => {
    let active = true;
    void client.commands
      .read(query)
      .then((value) => {
        if (active) {
          workspace.current = value.workspaceId;
          setData(value);
          setError("");
        }
      })
      .catch((failure) => {
        if (active) setError(String(failure));
      });
    return () => {
      active = false;
    };
  }, [client, query]);
  const request = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      const result = await action();
      refresh();
      return result;
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
      throw failure;
    } finally {
      setBusy(false);
    }
  };
  const run = (action: () => Promise<unknown>) => {
    void request(action).catch(() => {});
  };
  return {
    data,
    isCurrentWorkspace: (id: string) => workspace.current === id,
    cacheDraft: (draft: Draft) =>
      setData((current) =>
        current?.workspaceId === draft.workspaceId
          ? { ...current, drafts: [...current.drafts.filter((item) => item.id !== draft.id), draft] }
          : current,
      ),
    error,
    setError,
    busy,
    request,
    run,
    refresh,
  };
}
