import type { ExtensionInstallation } from "@pstdio/sdk/api";
import { workbenchPages } from "@pstdio/sdk/extensions";
import { useState } from "react";
import { createInstallationView, type ViewProps } from "./create-view";
import { InstallationContent } from "./installation-content";
import { useInstallations } from "./use-installations";

const Details = (props: ViewProps) => {
  const { client, projectId, t } = props;
  const data = useInstallations(client, projectId);
  const [error, setError] = useState<string>();
  const act = async (operation: () => Promise<unknown>) => {
    setError(undefined);
    try {
      await operation();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };
  const open = (job: ExtensionInstallation) =>
    act(() =>
      client.navigation.open({
        kind: "page",
        page: workbenchPages.extension,
        resource: {
          type: "extension",
          id: job.installName,
          extensionId: "pstdio",
          projectId: job.projectId ?? projectId,
        },
      }),
    );
  return (
    <InstallationContent
      {...data}
      error={error ?? data.error}
      t={t}
      onRetry={(job) => void act(() => client.installations.retry(job.id))}
      onOpen={(job) => void open(job)}
    />
  );
};
export default createInstallationView(Details);
