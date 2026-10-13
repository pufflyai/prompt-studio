import { eventRef, sessionEvents, type ViewFilterGroup } from "@pstdio/sdk/extensions";
import { useState } from "react";
import { autoBuildChanged } from "../../data/auto-build-mode";
import { useLiveValue } from "./use-live-value";
import type { PlanClient } from "./use-plan";

const readMode = (client: PlanClient) => client.commands["auto-build.read"]();
const modeEvents = [
  autoBuildChanged,
  sessionEvents.started,
  sessionEvents.completed,
  eventRef({ extensionId: "pstdio.pstdio-planner", id: "automation-run-changed" }),
];

export function useAutoBuild(client: PlanClient) {
  const { value: mode, setValue: setMode, error: readError } = useLiveValue(client, readMode, modeEvents);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const configure = async (
    enabled: boolean,
    prompt?: string,
    ignore?: ViewFilterGroup,
    requireMergedDependencies?: boolean,
    eligible?: ViewFilterGroup,
  ) => {
    setSaving(true);
    setError(undefined);
    try {
      const saved = await client.commands["auto-build.configure"]({
        enabled,
        prompt,
        ignore,
        requireMergedDependencies,
        eligible,
      });
      // The saved configuration is authoritative. Live reads own session details
      // and their errors must not make a successful Start or Stop retryable.
      setMode((current) => (current ? { ...current, ...saved } : current));
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      return false;
    } finally {
      setSaving(false);
    }
  };
  return { mode, saving, error: error ?? readError ?? mode?.error, configure };
}
