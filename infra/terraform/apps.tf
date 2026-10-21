locals {
  settings = {
    relay = {
      RELAY_HOST  = "0.0.0.0"
      RELAY_PORT  = "8080"
      S3_ENDPOINT = "https://${var.spaces_region}.digitaloceanspaces.com"
      S3_REGION   = var.spaces_region
      S3_BUCKET   = digitalocean_spaces_bucket.relay.name
    }
    manager = {
      MANAGER_HOST               = "0.0.0.0"
      MANAGER_PORT               = "8443"
      MANAGER_ORIGIN             = "https://${var.domains.manager}"
      RELAY_AUDIENCE             = "https://${var.domains.relay}"
      SESSION_LIFETIME_SECONDS   = "604800"
      SESSION_UPDATE_AGE_SECONDS = "86400"
      ACCESS_LIFETIME_SECONDS    = "300"
    }
  }
  secrets = {
    relay   = var.relay_secrets
    manager = var.manager_secrets
  }
  migrations = {
    relay   = "bun container-entrypoint.ts bun database-migration.js ./storage.js migrateRelayStorage relay"
    manager = "bun container-entrypoint.ts bun dist/database-migration.js ./dist/index.js migrateAccountManager manager"
  }
  database_urls = {
    for name, cluster in digitalocean_database_cluster.service : name => format(
      "postgresql://%s:%s@%s:%s/%s?sslmode=require",
      digitalocean_database_user.service[name].name,
      urlencode(digitalocean_database_user.service[name].password),
      cluster.host, cluster.port, digitalocean_database_db.service[name].name
    )
  }
}

resource "digitalocean_app" "service" {
  for_each = toset(["relay", "manager"])
  spec {
    name   = "${var.name}-${each.key}"
    region = var.region
    domain {
      name = var.domains[each.key]
      type = "PRIMARY"
    }
    dynamic "env" {
      for_each = local.settings[each.key]
      content {
        key   = env.key
        value = env.value
        scope = "RUN_TIME"
      }
    }
    dynamic "env" {
      # Iterate names only: secret values must never become resource identities.
      for_each = toset(nonsensitive(keys(local.secrets[each.key])))
      content {
        key   = env.value
        value = local.secrets[each.key][env.value]
        type  = "SECRET"
        scope = "RUN_TIME"
      }
    }
    env {
      key   = "DATABASE_URL"
      value = local.database_urls[each.key]
      type  = "SECRET"
      scope = "RUN_TIME"
    }
    env {
      key   = "DATABASE_CA_CERT"
      value = data.digitalocean_database_ca.service[each.key].certificate
      scope = "RUN_TIME"
    }
    service {
      name               = each.key
      http_port          = each.key == "relay" ? 8080 : 8443
      instance_count     = 1
      instance_size_slug = "basic-xxs"
      image {
        registry_type = "DOCR"
        repository    = var.images[each.key].repository
        digest        = var.images[each.key].digest
      }
      health_check {
        http_path = "/health"
      }
    }
    job {
      name               = "migrate"
      kind               = "PRE_DEPLOY"
      instance_count     = 1
      instance_size_slug = "basic-xxs"
      run_command        = local.migrations[each.key]
      env {
        key = "DATABASE_URL"
        value = format(
          "postgresql://%s:%s@%s:%s/%s?sslmode=require",
          digitalocean_database_cluster.service[each.key].user,
          urlencode(digitalocean_database_cluster.service[each.key].password),
          digitalocean_database_cluster.service[each.key].host,
          digitalocean_database_cluster.service[each.key].port,
          digitalocean_database_db.service[each.key].name
        )
        type  = "SECRET"
        scope = "RUN_TIME"
      }
      image {
        registry_type = "DOCR"
        repository    = var.images[each.key].repository
        digest        = var.images[each.key].digest
      }
    }
    ingress {
      rule {
        component { name = each.key }
        match {
          path { prefix = "/" }
        }
      }
    }
  }
}

output "service_urls" {
  value = { for name, app in digitalocean_app.service : name => app.live_url }
}
