resource "digitalocean_database_cluster" "service" {
  for_each   = toset(["relay", "manager"])
  name       = "${var.name}-${each.key}"
  engine     = "pg"
  version    = "16"
  size       = "db-s-1vcpu-1gb"
  region     = var.region
  node_count = 1
  lifecycle {
    prevent_destroy = true
  }
}

resource "digitalocean_database_db" "service" {
  for_each   = digitalocean_database_cluster.service
  cluster_id = each.value.id
  name       = each.key
}

resource "digitalocean_database_user" "service" {
  for_each   = digitalocean_database_cluster.service
  cluster_id = each.value.id
  name       = each.key
}

data "digitalocean_database_ca" "service" {
  for_each   = digitalocean_database_cluster.service
  cluster_id = each.value.id
}

resource "digitalocean_database_firewall" "service" {
  for_each   = digitalocean_database_cluster.service
  cluster_id = each.value.id
  rule {
    type  = "app"
    value = digitalocean_app.service[each.key].id
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
