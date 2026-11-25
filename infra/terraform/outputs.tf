# Give clients this address: pst login --manager <manager_url>. The manager tells each
# device the relay address.
output "manager_url" {
  value = "https://${var.host}${var.manager_path}"
}

output "relay_url" {
  value = "https://${var.host}${var.relay_path}"
}

output "psx_url" {
  value = contains(var.services, "psx") ? "https://${var.host}${var.psx_path}" : null
}

output "app_id" {
  value = digitalocean_app.cloud.id
}

output "live_url" {
  value = digitalocean_app.cloud.live_url
}

# For the external observer only; never pass these to the LOCAL reader extension.
output "monitoring_database_url" {
  value     = local.monitoring_enabled ? format("postgresql://%s:%s@%s:%s/relay?sslmode=verify-full&sslrootcert=/run/secrets/database-ca.pem", digitalocean_database_user.monitoring[0].name, urlencode(digitalocean_database_user.monitoring[0].password), local.cluster.host, local.cluster.port) : null
  sensitive = true
}
output "database_ca_certificate" {
  value     = data.digitalocean_database_ca.cloud.certificate
  sensitive = true
}

output "database_cluster_id" {
  value = digitalocean_database_cluster.cloud.id
}
