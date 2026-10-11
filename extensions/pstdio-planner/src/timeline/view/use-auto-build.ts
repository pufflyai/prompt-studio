import { eventRef, type ViewFilterGroup } from "@pstdio/sdk/extensions";
import { useState } from "react";
import { autoBuildChanged } from "../../data/auto-build-mode";
import { useLiveValue } from "./use-live-value";
import type { PlanClient } from "./use-plan";

const readMode = (client: PlanClient) => client.commands["auto-build.read"]();
const modeEvents = [autoBuildChanged, eventRef({ extensionId: "pstdio.pstdio-planner", id: "automation-run-changed" })];

export function useAutoBuild(client: PlanClient) {
  const { value: mode, setValue: setMode, error: readError } = useLiveValue(client, readMode, modeEvents);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const configure = async (enabled: boolean, filter?: ViewFilterGroup) => {
    setSaving(true);
    setError(undefined);
    try {
      await client.commands["auto-build.configure"]({ enabled, filter });
      setMode(await readMode(client));
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
