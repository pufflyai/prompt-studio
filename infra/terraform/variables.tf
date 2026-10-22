# Names every resource, for example "pstdio-production".
variable "name" {
  type = string
}

variable "app_region" {
  type = string
}

variable "database_region" {
  type = string
}

variable "database_size" {
  type    = string
  default = "db-s-1vcpu-1gb"
}

variable "spaces_region" {
  type = string
}

variable "bucket_name" {
  type = string
}

# Both services share this host: https://<host><relay_path> and https://<host><manager_path>.
variable "host" {
  type = string
}

variable "relay_path" {
  type    = string
  default = "/relay"
}

variable "manager_path" {
  type    = string
  default = "/accounts"
}

variable "psx_path" {
  type    = string
  default = "/psx"
}

# A DigitalOcean DNS zone that contains the host. App Platform then creates its record. Leave
# it null to manage DNS elsewhere.
variable "dns_zone" {
  type    = string
  default = null
}

variable "image_registry" {
  type = object({ type = string, name = string })
  default = {
    type = "GHCR"
    name = "pufflyai"
  }
}

variable "image_repositories" {
  type = object({ relay = string, manager = string, psx = string })
  default = {
    relay   = "prompt-studio/relay"
    manager = "prompt-studio/account-manager"
    psx     = "prompt-studio/psx"
  }
}

# Released digests. App Platform never builds source or updates an image on its own.
variable "image_digests" {
  type = object({ relay = string, manager = string, psx = string })
  validation {
    condition     = alltrue([for digest in values(var.image_digests) : can(regex("^sha256:[0-9a-f]{64}$", digest))])
    error_message = "Pin the relay and manager images to released SHA-256 digests."
  }
}

# "username:token" for a private registry. Public images need none.
variable "registry_credentials" {
  type      = string
  sensitive = true
  default   = null
}

variable "relay_secrets" {
  type = object({
    S3_ACCESS_KEY_ID     = string
    S3_SECRET_ACCESS_KEY = string
    RELAY_ACCESS_TRUST   = string
    RELAY_RECOVERY_KEY   = string
  })
  sensitive = true
}

variable "manager_secrets" {
  type = object({
    BETTER_AUTH_SECRET   = string
    GOOGLE_CLIENT_ID     = string
    GOOGLE_CLIENT_SECRET = string
  })
  sensitive = true
}

variable "psx_secrets" {
  type = object({
    S3_ACCESS_KEY_ID     = string
    S3_SECRET_ACCESS_KEY = string
    PSX_PUBLISH_TOKEN    = string
  })
  sensitive = true
}

# The first deployment runs only the manager: the relay must trust the manager's signing
# keys, which exist only once the manager runs. Every later deployment runs both.
variable "services" {
  type    = set(string)
  default = ["relay", "manager", "psx"]
  validation {
    condition     = contains(var.services, "manager") && length(setsubtract(var.services, ["relay", "manager", "psx"])) == 0
    error_message = "Run the manager, alone or with the relay."
  }
}
