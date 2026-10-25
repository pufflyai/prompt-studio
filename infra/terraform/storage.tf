# One PostgreSQL server with a database and login per service. Each service's migration
# limits its database to its own login, so the relay cannot reach the manager's keys.
resource "digitalocean_database_cluster" "cloud" {
  name       = var.name
  engine     = "pg"
  version    = "16"
  size       = var.database_size
  region     = var.database_region
  node_count = 1
  lifecycle {
    prevent_destroy = true
  }
}

resource "digitalocean_database_db" "service" {
  for_each   = local.services
  cluster_id = digitalocean_database_cluster.cloud.id
  name       = each.key
}

resource "digitalocean_database_user" "service" {
  for_each   = local.services
  cluster_id = digitalocean_database_cluster.cloud.id
  name       = each.key
  # Temporary: provider 2.106.0 reads empty PostgreSQL settings (ADR 0109).
  settings {}
}

data "digitalocean_database_ca" "cloud" {
  cluster_id = digitalocean_database_cluster.cloud.id
}

resource "digitalocean_database_firewall" "cloud" {
  cluster_id = digitalocean_database_cluster.cloud.id
  rule {
    type  = "app"
    value = digitalocean_app.cloud.id
  }
}

# Only encrypted current state, grace-period state, updates and blobs live here.
resource "digitalocean_spaces_bucket" "relay" {
  name          = var.bucket_name
  region        = var.spaces_region
  acl           = "private"
  force_destroy = false
  lifecycle {
    prevent_destroy = true
  }
}

resource "digitalocean_spaces_bucket" "psx" {
  count         = contains(var.services, "psx") ? 1 : 0
  name          = "${var.bucket_name}-psx"
  region        = var.spaces_region
  acl           = "private"
  force_destroy = false
  lifecycle {
    prevent_destroy = true
  }
}
