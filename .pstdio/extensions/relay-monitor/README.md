# Relay monitoring

A private repository-scoped Prompt Studio extension for LOCAL mode. It shows a health timeline and large charts for latency, failures, storage, cleanup, resources, capacity and observation age. Inspect data opens exact observations on demand. Its Canvas contains synthetic previews; the runtime imports no fixtures.

```sh
pst extensions dev .pstdio/extensions/relay-monitor
pst pstdio.relay-monitor connection check
pst pstdio.relay-monitor history --range 24h --section Overview
```

It monitors the production relay and manager. Configure `monitoring-production` in the extension's host-managed Connections settings. Use the query gateway base address and its **reader** credential. Connections and credentials belong to this host; source control contains only the definitions. An unconfigured connection shows setup instructions and unknown health.

The page exists only in LOCAL mode. Every command also requires a local workspace and rejects schedule, automation, event and other mode invocations. Requests use fixed queries and GET-only connection capabilities. No extension command changes the relay, runs collection, changes quotas or writes telemetry.

See the [setup and operations guide](../../../documentation/guides/development/0022-relay-monitoring.md) and [reference infrastructure](../../../infra/monitoring/README.md).
