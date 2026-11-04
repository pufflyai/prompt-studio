# Synthetic plan only: no real credentials, refresh or Apply.
provider "digitalocean" {}
module "device" {
  source        = "../"
  name          = "pstdio-validation-device"
  region        = "ams3"
  size          = "s-2vcpu-4gb"
  runtime_image = "ghcr.io/pufflyai/prompt-studio/device@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  bootstrap     = "{\"validation\":true}"
}
