import type { ExtensionInstallation } from "@pstdio/sdk/api";
import type { WebviewClient } from "@pstdio/sdk/extensions";
import { useEffect, useState } from "react";

export const useInstallations = (client: WebviewClient<Record<string, never>>, projectId?: string) => {
  const [jobs, setJobs] = useState<ExtensionInstallation[]>([]);
  const [error, setError] = useState<string>();
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const read = async () => {
      try {
        const next = await client.installations.list();
        if (!active) return;
        setJobs(next);
        setError(undefined);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : String(cause));
      } finally {
        if (active) timer = setTimeout(read, 1_000);
      }
    };
    void read();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [client]);
  return { jobs: jobs.filter((job) => !job.projectId || job.projectId === projectId), error };
};
