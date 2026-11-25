terraform {
  required_version = ">= 1.10, < 2.0"
  required_providers {
    digitalocean = { source = "digitalocean/digitalocean", version = "2.106.0" }
  }
}
variable "name" { type = string }
variable "region" { type = string }
variable "admin_public_key" {
  type = string
  validation {
    condition     = can(regex("^ssh-ed25519 [A-Za-z0-9+/=]+", var.admin_public_key))
    error_message = "Supply the dedicated operator's Ed25519 public key."
  }
}
variable "admin_cidrs" {
  type = list(string)
  validation {
    condition     = length(var.admin_cidrs) > 0 && alltrue([for cidr in var.admin_cidrs : can(cidrhost(cidr, 0)) && !contains(["0.0.0.0/0", "::/0"], cidr)])
    error_message = "Supply restricted administrator CIDRs for SSH."
  }
}
resource "digitalocean_droplet" "monitoring" {
  name       = var.name
  region     = var.region
  image      = "ubuntu-24-04-x64"
  size       = "s-1vcpu-512mb-10gb"
  backups    = false
  monitoring = false
  user_data = "#cloud-config\n${yamlencode({
    package_update = true,
    ssh_pwauth     = false,
    disable_root   = true,
    users = [{
      name                = "monitoring", lock_passwd = true, shell = "/bin/bash",
      groups              = ["sudo"], sudo = "ALL=(ALL) NOPASSWD:ALL",
      ssh_authorized_keys = [var.admin_public_key]
    }],
    packages = ["docker.io", "docker-compose-v2", "e2fsprogs"],
    write_files = [
      { path = "/usr/local/lib/relay-monitoring/prepare-disks.ts", permissions = "0644", content = file("${path.module}/../prepare-disks.ts") },
      { path = "/etc/systemd/system/relay-monitoring-disks.service", permissions = "0644", content = file("${path.module}/../relay-monitoring-disks.service") },
      { path = "/usr/local/lib/relay-monitoring/docker-monitoring.conf", permissions = "0644", content = file("${path.module}/../docker-monitoring.conf") },
      { path = "/etc/systemd/system/relay-monitoring.slice", permissions = "0644", content = file("${path.module}/../relay-monitoring.slice") }
    ],
    runcmd = [["sh", "-euc", <<-BOOTSTRAP
      systemctl enable --now docker
      docker run --rm --entrypoint cat oven/bun:1.4.4 /usr/local/bin/bun > /usr/local/bin/bun.next
      chmod 0755 /usr/local/bin/bun.next
      /usr/local/bin/bun.next -e 'if (Bun.version !== "1.4.4") process.exit(1)'
      mv /usr/local/bin/bun.next /usr/local/bin/bun
      systemctl daemon-reload
      systemctl enable --now relay-monitoring.slice relay-monitoring-disks.service
      mkdir -p /etc/systemd/system/docker.service.d
      cp /usr/local/lib/relay-monitoring/docker-monitoring.conf /etc/systemd/system/docker.service.d/monitoring.conf
      systemctl daemon-reload
    BOOTSTRAP
    ]]
  })}"
  lifecycle { prevent_destroy = true }
}
resource "digitalocean_firewall" "monitoring" {
  name        = var.name
  droplet_ids = [digitalocean_droplet.monitoring.id]
  inbound_rule {
    protocol         = "tcp"
    port_range       = "22"
    source_addresses = var.admin_cidrs
  }
  inbound_rule {
    protocol         = "tcp"
    port_range       = "80"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }
  inbound_rule {
    protocol         = "tcp"
    port_range       = "443"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }
  outbound_rule {
    protocol              = "tcp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
  outbound_rule {
    protocol              = "udp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
}
output "monitoring_address" { value = digitalocean_droplet.monitoring.ipv4_address }
