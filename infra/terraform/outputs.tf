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
