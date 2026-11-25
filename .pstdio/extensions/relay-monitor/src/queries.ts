import { environment } from "./model";

// Query text is owned here. Command callers can select IDs, never supply PromQL, LogQL or an address.
export const expressions = (bin: number): Record<string, string> => {
  const env = `{environment="${environment}"}`;
  const fresh = (name: string, age: number, extra = "") =>
    `${name}{environment="${environment}"${extra}} and on(environment${extra ? ",account" : ""}) (time() - pstdio_relay_${extra ? "account" : "provider"}_observed_timestamp_seconds${env} < ${age})`;
  const configuredAccounts = `pstdio_relay_account_quota_bytes${env}`;
  const observedAccounts = `(pstdio_relay_account_observation_success${env} == 1) and on(environment,account) (time() - pstdio_relay_account_observed_timestamp_seconds${env} < 1800) and on(environment,account) ${configuredAccounts}`;
  const accountTotal = (metric: string, group: string) => {
    const rows = `${metric}${env} and on(environment,account) (${observedAccounts})`;
    // Omit totals when a configured account is missing from this observation.
    return `(sum by(${group}) (${rows}) and on(${group}) (count by(${group}) (${rows}) == on(environment) group_left count by(environment) (${configuredAccounts})))`;
  };
  return {
    latency: `max_over_time(pstdio_relay:latency_quantile_seconds${env}[${bin}s]) * 1000`,
    errors: `sum by (status) (increase(pstdio_relay_http_requests_total{environment="${environment}",operation!="health",status=~"4..|5.."}[${bin}s]))`,
    storage: `${accountTotal("pstdio_relay_storage_bytes", "environment,kind")} / 1073741824`,
    resources: `(${fresh("pstdio_relay_resource_percent", 1800)}) and on(environment) (pstdio_relay_provider_collection_success${env} == 1)`,
    cleanup: `${accountTotal("pstdio_relay_cleanup_eligible_bytes", "environment")} / 1048576`,
    live: `(pstdio_relay_probe_duration_seconds{environment="${environment}",check="live"} and on(environment,check) (time() - pstdio_relay_check_observed_timestamp_seconds${env} < 600)) * 1000`,
    capacity: `((100 * pstdio_relay_account_storage_bytes${env} / ${configuredAccounts}) and on(environment,account) (${observedAccounts})) or label_replace((pstdio_relay_probe_budget_used_percent${env} and on(environment) (pstdio_relay_probe_budget_observation_success${env} == 1) and on(environment) (time() - pstdio_relay_prober_heartbeat_timestamp_seconds${env} < 600)), "account", "probe-budget", "", "")`,
    sync: `(pstdio_relay_probe_duration_seconds{environment="${environment}",check="sync"} and on(environment,check) (time() - pstdio_relay_check_observed_timestamp_seconds${env} < 600)) * 1000`,
    blobs: `(pstdio_relay_probe_duration_seconds{environment="${environment}",check="blobs"} and on(environment,check) (time() - pstdio_relay_check_observed_timestamp_seconds${env} < 1200)) * 1000`,
    tls: `((probe_ssl_earliest_cert_expiry${env} - time()) / 86400) and on(environment) (probe_success${env} == 1)`,
    deployments: `max by(release)(pstdio_relay_build_info${env} and on(environment) (time() - pstdio_relay_observation_timestamp_seconds${env} < 120))`,
    ingestion: `time() - pstdio_relay:source_observed_timestamp_seconds${env}`,
    health: `max_over_time(pstdio_relay:check_severity${env}[${bin}s])`,
    status: `pstdio_relay:check_state${env}`,
    observed: `pstdio_relay:check_observed_timestamp_seconds${env}`,
  };
};
