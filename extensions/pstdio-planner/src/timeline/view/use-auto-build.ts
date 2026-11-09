import { type ExtensionHarnessInput, eventRef, type ViewFilterGroup, viewDataEvents } from "@pstdio/sdk/extensions";
import { useState } from "react";
import { autoBuildChanged } from "../../data/auto-build-mode";
import { plannerTicketsChanged } from "../../events";
import type { PlanClient } from "./use-plan";
import { usePlannerQuery } from "./use-planner-query";

const readMode = (client: PlanClient) => client.commands["auto-build.read"]();
const modeEvents = [
  autoBuildChanged,
  plannerTicketsChanged,
  viewDataEvents.sessionsChanged,
  eventRef({ extensionId: "pstdio.pstdio-planner", id: "automation-run-changed" }),
];

export function useAutoBuild(client: PlanClient) {
  const {
    value: mode,
    setValue: setMode,
    error: readError,
    retry,
    query,
  } = usePlannerQuery(client, "auto-build", readMode, modeEvents);
  const [operation, setOperation] = useState<{ query: typeof query; saving: boolean; error?: string }>({
    query,
    saving: false,
  });
  const saving = operation.query === query && operation.saving;
  const error = operation.query === query ? operation.error : undefined;
  const run = async (save: () => Promise<Awaited<ReturnType<PlanClient["commands"]["auto-build.configure"]>>>) => {
    setOperation({ query, saving: true });
    try {
      const saved = await save();
      setMode((current) => (current ? { ...current, ...saved } : current));
      return true;
    } catch (reason) {
      setOperation((current) =>
        current.query === query
          ? { ...current, error: reason instanceof Error ? reason.message : String(reason) }
          : current,
      );
      return false;
    } finally {
      setOperation((current) => (current.query === query ? { ...current, saving: false } : current));
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
