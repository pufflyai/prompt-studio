variable "name" {
  type    = string
  default = "pstdio"
}

variable "region" {
  type    = string
  default = "ams3"
}

variable "spaces_region" {
  type    = string
  default = "ams3"
}

variable "bucket_name" {
  type = string
}

variable "domains" {
  type = object({ relay = string, manager = string })
}

# Mirror released digests into DOCR. No source build or automatic image update runs in App Platform.
variable "images" {
  type = map(object({ repository = string, digest = string }))
  validation {
    condition     = alltrue([for name in ["relay", "manager"] : can(regex("^sha256:[0-9a-f]{64}$", var.images[name].digest))])
    error_message = "Supply relay and manager images pinned to released SHA-256 digests."
  }
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
