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
  const { value: mode, setValue: setMode } = useLiveValue(client, readMode, modeEvents);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const refresh = async () => {
    setSaving(true);
    setError(undefined);
    try {
      setMode(await readMode(client));
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      return false;
    } finally {
      setSaving(false);
    }
  };
  const configure = async (enabled: boolean, prompt?: string, ignore?: ViewFilterGroup, blockOnReview?: boolean) => {
    setSaving(true);
    setError(undefined);
    try {
      await client.commands["auto-build.configure"]({ enabled, prompt, ignore, blockOnReview });
      setMode(await readMode(client));
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      return false;
    } finally {
      setSaving(false);
    }
  };
  // Saved run failures belong to the status popover, not a new configuration attempt.
  return { mode, saving, error, configure, refresh };
}
