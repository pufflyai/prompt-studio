# Relay monitoring

The repo-local Relay monitoring extension is a chart-based client for these services. It replaces the Grafana dashboard for relay operations. Alloy, Prometheus-compatible metrics, Loki-compatible logs and independent alerts continue running on servers.

Use the [setup and operations guide](../../documentation/guides/development/0022-relay-monitoring.md) for collector reuse, provisioning, credentials, retention, canaries, rollout and incident response. The reference stack is optional when compatible backends already exist. Nothing here applies infrastructure or creates paid resources automatically.

## Responding to alerts

- **RelayCheckFailed:** inspect the failing check and its observation time in Relay monitoring. HTTP success does not establish encrypted sync, blobs or live delivery. Compare service failure codes and recent deployments before changing anything.
- **RelayObservationMissing:** check collector readiness, write credentials, observer permissions and the canary budget. An unknown observation must not be interpreted as success.
- **RelayCapacityWarning:** inspect the configured account alias and cleanup backlog. Restore headroom through the normal owner workflow; the extension has no delete or quota-change command.
- **MonitoringDataLoss:** inspect disk headroom, retention, ingestion rejections and rule failures. Restore collection before using affected intervals as availability evidence.
- **External watchdog missed:** check the monitoring VM and ingestion path from outside the host. The watchdog receiver must remain outside its failure domain.

Keep credentials, private addresses, account identifiers and incident evidence out of public issues and pull requests.
