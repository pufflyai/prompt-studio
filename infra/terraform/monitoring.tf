# Disabled by default. Alloy shares the existing relay container and has no public
# ingress. The VM observer uses the separate SELECT-only database login below.
variable "monitoring" {
  type = object({
    metrics_write_url   = string
    metrics_write_token = string
    logs_write_url      = string
    logs_write_token    = string
  })
  default   = null
  sensitive = true
  validation {
    condition     = var.monitoring == null ? true : startswith(var.monitoring.metrics_write_url, "https://") && startswith(var.monitoring.logs_write_url, "https://")
    error_message = "Monitoring needs authenticated HTTPS ingestion endpoints."
  }
}
resource "digitalocean_database_user" "monitoring" {
  count      = local.monitoring_enabled ? 1 : 0
  cluster_id = digitalocean_database_cluster.cloud.id
  name       = "relay_monitoring"
  settings {}
}
