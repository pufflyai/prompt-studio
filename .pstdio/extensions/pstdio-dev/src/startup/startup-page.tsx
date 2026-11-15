import { useCommandQuery } from "@pstdio/sdk/extensions/react";
import { useBenchmarks } from "../webview/client";
import { StartupView } from "./startup-view";

export const StartupPage = () => {
  const { client } = useBenchmarks();
  const timeline = useCommandQuery({
    queryKey: ["startup-timeline"],
    command: () => client.commands["diagnostics.startup-timeline"](),
  });
  return (
    <StartupView
      launches={timeline.data?.launches ?? []}
      projectNames={timeline.data?.projectNames ?? {}}
      logPath={timeline.data?.logPath}
      error={timeline.error?.message}
      loading={timeline.isFetching}
      onRefresh={() => void timeline.refetch()}
    />
  );
};
