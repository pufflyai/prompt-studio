import { eventRef, type ViewFilterGroup, viewDataEvents } from "@pstdio/sdk/extensions";
import { useState } from "react";
import { autoBuildChanged } from "../../data/auto-build-mode";
import { plannerTicketsChanged } from "../../events";
import { useLiveValue } from "./use-live-value";
import type { PlanClient } from "./use-plan";

const readMode = (client: PlanClient) => client.commands["auto-build.read"]();
const modeEvents = [
  autoBuildChanged,
  plannerTicketsChanged,
  viewDataEvents.sessionsChanged,
  eventRef({ extensionId: "pstdio.pstdio-planner", id: "automation-run-changed" }),
];

export function useAutoBuild(client: PlanClient) {
  const { value: mode, setValue: setMode } = useLiveValue(client, readMode, modeEvents);
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
  // Saved run failures belong to the status popover, not a new configuration attempt.
  return { mode, saving, error, configure };
}
