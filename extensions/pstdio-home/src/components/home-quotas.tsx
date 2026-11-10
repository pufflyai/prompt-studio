import { useEffect, useState } from "react";
import type { QuotaReport } from "../quotas";
import { QuotaGraph } from "./quota-graph";

interface HomeQuotasProps {
  client: { commands: { quotas(): Promise<QuotaReport[]> } };
}

export const HomeQuotas = (props: HomeQuotasProps) => {
  const { client } = props;
  const [providers, setProviders] = useState<QuotaReport[]>([]);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  useEffect(() => {
    const timer = setInterval(() => setRefresh((value) => value + 1), 60 * 60 * 1000);
    return () => clearInterval(timer);
  }, []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Refresh explicitly invalidates the quota snapshot.
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(undefined);
    void client.commands
      .quotas()
      .then((reports) => {
        if (active) setProviders(reports);
      })
      .catch(() => {
        if (active) setError("Could not check quotas. Refresh to try again.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [client, refresh]);
  return <QuotaGraph providers={providers} loading={loading} error={error} onRefresh={() => setRefresh(refresh + 1)} />;
};
