import { useState } from "react";
import type { PlanClient } from "./use-plan";

export function useAutoBuild(client: PlanClient, t: (key: string, fallback?: string) => string) {
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const run = async () => {
    setRunning(true);
    setMessage(undefined);
    setError(undefined);
    try {
      const result = await client.commands["auto-build"]();
      if (result.started.length) {
        setMessage(
          t("timeline.autoBuild.started", "Started {tickets}.").replace(
            "{tickets}",
            result.started.map(({ ticket }) => ticket).join(", "),
          ),
        );
      } else if (!result.errors.length) {
        setMessage(
          t("timeline.autoBuild.idle", "No tickets started. Check Todo tickets, dependencies, and available capacity."),
        );
      }
      if (result.errors.length) {
        setError(result.errors.map(({ ticket, message }) => `${ticket}: ${message}`).join("\n"));
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setRunning(false);
    }
  };
  return { running, message, error, run };
}
