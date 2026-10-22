# Plans the module with synthetic inputs and no cloud access. Never apply it.
# Credentials come from DIGITALOCEAN_TOKEN, SPACES_ACCESS_KEY_ID and SPACES_SECRET_ACCESS_KEY.
provider "digitalocean" {}

module "cloud" {
  source          = "../"
  name            = "pstdio-validation"
  app_region      = "ams"
  database_region = "ams3"
  spaces_region   = "ams3"
  bucket_name     = "pstdio-validation-only"
  host            = "base.example.com"
  dns_zone        = "example.com"
  image_digests = {
    relay   = "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    manager = "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
  }
  relay_secrets = {
    S3_ACCESS_KEY_ID     = "validation-only"
    S3_SECRET_ACCESS_KEY = "validation-only"
    RELAY_ACCESS_TRUST   = "{\"issuer\":\"https://base.example.com/accounts\",\"audience\":\"https://base.example.com/relay\",\"jwks\":{\"keys\":[]}}"
    RELAY_RECOVERY_KEY   = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
  }
  manager_secrets = {
    BETTER_AUTH_SECRET   = "validation-only-never-use-in-a-deployment"
    GOOGLE_CLIENT_ID     = "validation-only"
    GOOGLE_CLIENT_SECRET = "validation-only"
  }
}

terraform {
  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "2.106.0"
    }
  }
}
