# Synthetic inputs for planning an empty local workspace. Never apply these values.
bucket_name = "pstdio-validation-only"
domains     = { relay = "relay.example.com", manager = "accounts.example.com" }
images = {
  relay   = { repository = "pstdio/relay", digest = "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }
  manager = { repository = "pstdio/account-manager", digest = "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" }
}
relay_secrets = {
  S3_ACCESS_KEY_ID     = "validation-only"
  S3_SECRET_ACCESS_KEY = "validation-only"
  RELAY_ACCESS_TRUST   = "{\"issuer\":\"https://accounts.example.com\",\"audience\":\"https://relay.example.com\",\"jwks\":{\"keys\":[]}}"
  RELAY_RECOVERY_KEY   = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
}
manager_secrets = {
  BETTER_AUTH_SECRET   = "validation-only-never-use-in-a-deployment"
  GOOGLE_CLIENT_ID     = "validation-only"
  GOOGLE_CLIENT_SECRET = "validation-only"
}
