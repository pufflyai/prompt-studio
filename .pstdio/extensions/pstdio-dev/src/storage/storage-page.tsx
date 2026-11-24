import { useCommandQuery } from "@pstdio/sdk/extensions/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { storageAutomationChanged, storageReportChanged } from "../diagnostics/events";
import { useBenchmarks } from "../webview/client";
import { StorageView } from "./storage-view";

export const StoragePage = () => {
  const { client } = useBenchmarks();
  const queryClient = useQueryClient();
  const report = useCommandQuery({
    queryKey: ["storage-report"],
    command: () => client.commands["diagnostics.storage-report"](),
  });
  const measure = useMutation({ mutationFn: () => client.commands["diagnostics.storage-refresh"]() });
  const schema = useCommandQuery({
    queryKey: ["database-schema"],
    command: () => client.commands["diagnostics.database-schema"](),
  });
  useEffect(() => {
    const refresh = () => void queryClient.invalidateQueries({ queryKey: ["storage-report"] });
    const unsubscribeReport = client.events.subscribe(storageReportChanged, refresh);
    const unsubscribeRun = client.events.subscribe(storageAutomationChanged, refresh);
    return () => {
      unsubscribeReport();
      unsubscribeRun();
    };
  }, [client, queryClient]);
  return (
    <StorageView
      report={report.data?.report ?? null}
      measuring={measure.isPending || Boolean(report.data?.measuring)}
      error={measure.error?.message ?? report.error?.message ?? report.data?.error}
      onMeasure={() => measure.mutate()}
      schema={schema.data ?? null}
      schemaLoading={schema.isFetching}
      schemaError={schema.error?.message}
      onReloadSchema={() => void schema.refetch()}
    />
  );
};
