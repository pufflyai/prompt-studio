locals {
  monitoring_enabled = nonsensitive(var.monitoring != null)
  services           = var.services
  paths = {
    relay   = var.relay_path
    manager = var.manager_path
    psx     = var.psx_path
  }
  ports = {
    relay   = 8080
    manager = 8443
    psx     = 8080
  }
  settings = {
    psx = {
      PSX_HOST    = "0.0.0.0"
      PSX_PORT    = "8080"
      S3_ENDPOINT = "https://${var.spaces_region}.digitaloceanspaces.com"
      S3_REGION   = var.spaces_region
      S3_BUCKET   = one(digitalocean_spaces_bucket.psx[*].name)
    }
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
      MANAGER_ORIGIN             = "https://${var.host}${var.manager_path}"
      RELAY_AUDIENCE             = "https://${var.host}${var.relay_path}"
      SESSION_LIFETIME_SECONDS   = "604800"
      SESSION_UPDATE_AGE_SECONDS = "86400"
      ACCESS_LIFETIME_SECONDS    = "300"
    }
  }
  secrets = {
    relay   = var.relay_secrets
    manager = var.manager_secrets
    psx     = var.psx_secrets
  }
  migrations = {
    relay   = "bun container-entrypoint.ts bun database-migration.js ./storage.js migrateRelayStorage relay"
    manager = "bun container-entrypoint.ts bun dist/database-migration.js ./dist/index.js migrateAccountManager manager"
    psx     = "bun container-entrypoint.ts bun dist/database-migration.js ./dist/index.js migratePsx psx"
  }
  cluster = digitalocean_database_cluster.cloud
  # Services use their own login. Only the migration jobs get the server owner's login.
  database_urls = {
    for name in local.services : name => format(
      "postgresql://%s:%s@%s:%s/%s?sslmode=require",
      digitalocean_database_user.service[name].name,
      urlencode(digitalocean_database_user.service[name].password),
      local.cluster.host, local.cluster.port, digitalocean_database_db.service[name].name
    )
  }
  migration_urls = {
    for name in local.services : name => format(
      "postgresql://%s:%s@%s:%s/%s?sslmode=require",
      local.cluster.user, urlencode(local.cluster.password),
      local.cluster.host, local.cluster.port, digitalocean_database_db.service[name].name
    )
  }
}

# The relay and the account manager ship together in one app on one host, each under its
# own path. Each keeps its own settings, secrets, database and database login.
resource "digitalocean_app" "cloud" {
  spec {
    name   = var.name
    region = var.app_region
    domain {
      name = var.host
      type = "PRIMARY"
      zone = var.dns_zone
    }
    dynamic "service" {
      for_each = local.services
      content {
        name               = service.key
        http_port          = local.ports[service.key]
        internal_ports     = local.monitoring_enabled && contains(["relay", "manager"], service.key) ? (service.key == "relay" ? [9464, 4318] : [9464]) : []
        instance_count     = 1
        instance_size_slug = "basic-xxs"
        image {
          registry_type        = var.image_registry.type
          registry             = var.image_registry.name
          repository           = var.image_repositories[service.key]
          digest               = var.image_digests[service.key]
          registry_credentials = var.registry_credentials
        }
        health_check {
          http_path = "/health"
        }
        dynamic "env" {
          for_each = merge(local.settings[service.key], local.monitoring_enabled && contains(["relay", "manager"], service.key) ? {
            METRICS_HOST                     = "0.0.0.0", METRICS_PORT = "9464", MONITORING_ENVIRONMENT = "production",
            OTEL_EXPORTER_OTLP_LOGS_ENDPOINT = service.key == "relay" ? "http://127.0.0.1:4318/v1/logs" : "http://relay:4318/v1/logs"
            TELEMETRY_RELEASE                = replace(var.image_digests[service.key], "sha256:", "sha256-")
          } : {})
          content {
            key   = env.key
            value = env.value
            scope = "RUN_TIME"
          }
        }
        dynamic "env" {
          # Iterate names only: secret values must never become resource identities.
          for_each = toset(nonsensitive([for key, value in local.secrets[service.key] : key if value != null]))
          content {
            key   = env.value
            value = local.secrets[service.key][env.value]
            type  = "SECRET"
            scope = "RUN_TIME"
          }
        }
        dynamic "env" {
          for_each = local.monitoring_enabled && service.key == "relay" ? toset(["METRICS_WRITE_URL", "METRICS_WRITE_TOKEN", "LOGS_WRITE_URL", "LOGS_WRITE_TOKEN", "RELAY_METRICS_TARGET", "MANAGER_METRICS_TARGET"]) : toset([])
          content {
            key = env.value
            value = {
              METRICS_WRITE_URL      = var.monitoring.metrics_write_url
              METRICS_WRITE_TOKEN    = var.monitoring.metrics_write_token
              LOGS_WRITE_URL         = var.monitoring.logs_write_url
              LOGS_WRITE_TOKEN       = var.monitoring.logs_write_token
              RELAY_METRICS_TARGET   = "127.0.0.1:9464"
              MANAGER_METRICS_TARGET = "manager:9464"
            }[env.value]
            type  = "SECRET"
            scope = "RUN_TIME"
          }
        }
        env {
          key   = "DATABASE_URL"
          value = local.database_urls[service.key]
          type  = "SECRET"
          scope = "RUN_TIME"
        }
        env {
          key   = "DATABASE_CA_CERT"
          value = data.digitalocean_database_ca.cloud.certificate
          scope = "RUN_TIME"
        }
      }
    }
    dynamic "job" {
      for_each = local.services
      content {
        name               = "migrate-${job.key}"
        kind               = "PRE_DEPLOY"
        instance_count     = 1
        instance_size_slug = "basic-xxs"
        run_command        = local.migrations[job.key]
        image {
          registry_type        = var.image_registry.type
          registry             = var.image_registry.name
          repository           = var.image_repositories[job.key]
          digest               = var.image_digests[job.key]
          registry_credentials = var.registry_credentials
        }
        dynamic "env" {
          for_each = local.settings[job.key]
          content {
            key   = env.key
            value = env.value
            scope = "RUN_TIME"
          }
        }
        dynamic "env" {
          for_each = toset(nonsensitive([for key, value in local.secrets[job.key] : key if value != null]))
          content {
            key   = env.value
            value = local.secrets[job.key][env.value]
            type  = "SECRET"
            scope = "RUN_TIME"
          }
        }
        env {
          key   = "DATABASE_URL"
          value = local.migration_urls[job.key]
          type  = "SECRET"
          scope = "RUN_TIME"
        }
        env {
          key   = "DATABASE_CA_CERT"
          value = data.digitalocean_database_ca.cloud.certificate
          scope = "RUN_TIME"
        }
      }
    }
    ingress {
      dynamic "rule" {
        for_each = local.services
        content {
          # App Platform removes the path, so each service keeps serving at /.
          component {
            name                 = rule.key
            preserve_path_prefix = false
          }
          match {
            path {
              prefix = local.paths[rule.key]
            }
          }
        }
      }
    }
  }
}
