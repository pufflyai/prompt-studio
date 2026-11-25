import { createWebviewClient } from "@pstdio/sdk/extensions";
import { useWebviewCommandQuery } from "@pstdio/sdk/extensions/react";
import { useRef, useState } from "react";
import type { ExampleViewInput } from "../../view-context";

export const useMarmaladeInspectorSize = (input: ExampleViewInput) => {
  const [client] = useState(() => createWebviewClient(input.host.bridge));
  const scope = { scope: "project" as const, scopeId: input.projectId };
  const name = "marmalade.inspector.layers-size";
  const preference = useWebviewCommandQuery(client.preferences.query(name, scope));
  const [chosen, setChosen] = useState<number>();
  const [error, setError] = useState("");
  const writes = useRef(Promise.resolve());
  const revision = useRef(0);
  const save = (size: number) => {
    setChosen(size);
    const ownRevision = ++revision.current;
    // Only completed resizes are stored; serialize them so older writes cannot win on reopen.
    writes.current = writes.current.then(async () => {
      try {
        await client.preferences.set(name, size, scope);
        if (ownRevision === revision.current) setError("");
      } catch (error) {
        if (ownRevision === revision.current) setError(String(error));
      }
    });
  };
  const stored = preference.data?.value;
  const size = chosen ?? (typeof stored === "number" && Number.isFinite(stored) && stored >= 96 ? stored : 240);
  return {
    size,
    save,
    error: error || preference.error?.message || "",
    retry: error ? () => save(size) : preference.refresh,
  };
};
