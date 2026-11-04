variable "name" { type = string }
variable "region" { type = string }
variable "size" { type = string }
variable "runtime_image" {
  type = string
  validation {
    condition     = can(regex("^ghcr.io/pufflyai/prompt-studio/device@sha256:[0-9a-f]{64}$", var.runtime_image))
    error_message = "Use the released execution device image's immutable digest."
  }
}
variable "bootstrap" {
  type      = string
  sensitive = true
}

# Alternative resource owner to Devices/CLI provisioning. Never import/manage the same device in both.
resource "digitalocean_droplet" "device" {
  name   = var.name
  region = var.region
  size   = var.size
  image  = "ubuntu-24-04-x64"
  user_data = "#cloud-config\n${yamlencode({
    packages = ["docker.io"]
    write_files = [{
      path        = "/opt/pstdio/home/.pstdio/bootstrap.json"
      permissions = "0600"
      content     = var.bootstrap
    }]
    runcmd = [
      ["chown", "-R", "1000:1000", "/opt/pstdio/home"],
      ["chmod", "0700", "/opt/pstdio/home", "/opt/pstdio/home/.pstdio"],
      ["docker", "pull", var.runtime_image],
      ["docker", "run", "-d", "--init", "--restart", "unless-stopped", "--name", "pstdio-device", "--mount", "type=bind,source=/opt/pstdio/home,target=/home/bun", "-e", "PSTDIO_CLOUD_BOOTSTRAP_FILE=/home/bun/.pstdio/bootstrap.json", var.runtime_image]
    ]
  })}"
}
resource "digitalocean_firewall" "device" {
  name        = "${var.name}-outbound"
  droplet_ids = [digitalocean_droplet.device.id]
  dynamic "outbound_rule" {
    for_each = toset(["tcp", "udp", "icmp"])
    content {
      protocol              = outbound_rule.value
      port_range            = outbound_rule.value == "icmp" ? null : "1-65535"
      destination_addresses = ["0.0.0.0/0", "::/0"]
    }
  }
}
output "device_provider_id" { value = digitalocean_droplet.device.id }
