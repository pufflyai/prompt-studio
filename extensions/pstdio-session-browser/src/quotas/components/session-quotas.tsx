import { useEffect, useState } from "react";
import { pollQuotas } from "../quota-polling";
import type { QuotaReport } from "../quotas";
import { QuotaGraph } from "./quota-graph";

interface SessionQuotasProps {
  visible: boolean;
  client: { commands: { quotas(): Promise<QuotaReport[]> } };
}

export const SessionQuotas = (props: SessionQuotasProps) => {
  const { client, visible } = props;
  const [providers, setProviders] = useState<QuotaReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  useEffect(
    () =>
      visible
        ? pollQuotas({
            read: () => client.commands.quotas(),
            onData: (reports) => {
              setProviders(reports);
              setError(undefined);
              setLoading(false);
            },
            onError: () => {
              setError("Could not check quotas. Retrying automatically.");
              setLoading(false);
            },
          })
        : undefined,
    [client, visible],
  );
  return <QuotaGraph providers={providers} loading={loading} error={error} />;
};
