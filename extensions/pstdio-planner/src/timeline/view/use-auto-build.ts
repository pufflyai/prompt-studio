import { type ExtensionHarnessInput, eventRef, type ViewFilterGroup, viewDataEvents } from "@pstdio/sdk/extensions";
import { useWebviewCommandQuery, useWebviewScope, useWebviewVisibility } from "@pstdio/sdk/extensions/react";
import { useLayoutEffect, useState } from "react";
import { autoBuildChanged } from "../../data/auto-build-mode";
import { plannerTicketsChanged } from "../../events";
import { createAutoBuildProjection } from "./auto-build-projection";
import type { PlanClient } from "./use-plan";

const modeEvents = [
  autoBuildChanged,
  plannerTicketsChanged,
  viewDataEvents.sessionsChanged,
  eventRef({ extensionId: "pstdio.pstdio-planner", id: "automation-run-changed" }),
];

export function useAutoBuild(client: PlanClient) {
  useWebviewScope(client.queries);
  const query = client.commands["auto-build.read"].query(undefined, { events: modeEvents });
  const visible = useWebviewVisibility();
  const [current, setCurrent] = useState(() => ({ query, projection: createAutoBuildProjection(query) }));
  let owner = current;
  if (owner.query !== query) {
    owner = { query, projection: createAutoBuildProjection(query) };
    setCurrent(owner);
  }
  const { projection } = owner;
  const { data: mode, error: readError, refresh: retry } = useWebviewCommandQuery(projection, visible);
  const [refreshOwner, setRefreshOwner] = useState<{ projection: typeof projection; abort: AbortController }>();
  useLayoutEffect(() => {
    if (!visible) return;
    const abort = new AbortController();
    setRefreshOwner({ projection, abort });
    return () => {
      abort.abort();
      projection.retire();
    };
  }, [projection, visible]);
  const [operation, setOperation] = useState<{
    query: typeof query;
    owner?: typeof refreshOwner;
    action?: number;
    saving: boolean;
    error?: string;
  }>({
    query,
    saving: false,
  });
  const saving =
    operation.query === query &&
    operation.owner === refreshOwner &&
    !refreshOwner?.abort.signal.aborted &&
    operation.saving;
  const error =
    operation.query === query && operation.owner === refreshOwner && !refreshOwner?.abort.signal.aborted
      ? operation.error
      : undefined;
  const run = async (save: () => Promise<Awaited<ReturnType<PlanClient["commands"]["auto-build.configure"]>>>) => {
    const abort = refreshOwner?.abort;
    if (!visible || !abort || abort.signal.aborted || refreshOwner?.projection !== projection) return false;
    const token = projection.begin();
    setOperation({ query, owner: refreshOwner, action: token.action, saving: true });
    try {
      const saved = await save();
      if (!abort.signal.aborted) projection.accept(token, saved);
      // The command already committed. A failed catch-up remains a read error with its ACK intact.
      if (projection.current(token) && !abort.signal.aborted) {
        try {
          await query.refresh(abort.signal);
          projection.complete(token);
        } catch {}
      }
      return true;
    } catch (reason) {
      setOperation((current) =>
        !abort.signal.aborted &&
        current.owner === refreshOwner &&
        current.query === query &&
        current.action === token.action
          ? { ...current, error: reason instanceof Error ? reason.message : String(reason) }
          : current,
      );
      return false;
    } finally {
      setOperation((current) =>
        current.query === query && current.action === token.action ? { ...current, saving: false } : current,
      );
    }
  };
  const configure = async (
    enabled: boolean,
    prompt?: string,
    requireMergedDependencies?: boolean,
    eligible?: ViewFilterGroup,
    supervisorModel?: ExtensionHarnessInput,
  ) =>
    run(() =>
      client.commands["auto-build.configure"]({
        enabled,
        prompt,
        requireMergedDependencies,
        eligible,
        supervisorModel,
      }),
    );
  const transition = (action: "pause" | "resume" | "stop") => run(() => client.commands[`auto-build.${action}`]());
  // Saved run failures belong to the activity popover, not a new configuration attempt.
  return { mode, saving, error, readError, retry, configure, transition };
}
