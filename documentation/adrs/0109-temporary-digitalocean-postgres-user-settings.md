# Temporary explicit PostgreSQL user settings for DigitalOcean

Proposed: 2026-10-25

Status: Accepted.

## Intended design

The portable DigitalOcean module creates a normal PostgreSQL login for each
service. A later plan with unchanged inputs should leave those logins alone.
PostgreSQL has no application-specific user settings in this module.

## External limitation

DigitalOcean provider 2.106.0 records an empty `settings` block when it reads a
PostgreSQL user. When configuration omits the block, the next plan removes it.
Applying that removal calls the database-user update endpoint without
`user_settings`, which the API rejects with HTTP 400. This blocked the first live
relay deployment after the manager login had been created successfully.

The published provider cannot represent the absent settings consistently across
create and read. Fixing its read normalization requires an upstream provider
release; changing database users, credentials or application data cannot fix it.

## Temporary workaround

Declare `settings {}` explicitly on the module's PostgreSQL users. This matches
the provider's current state representation and avoids the invalid removal
update. It adds no database policy, credential changes or lifecycle exceptions.
Do not ignore user changes or recreate existing users.

The workaround stays in `infra/terraform/storage.tf`. Service code and images
are unchanged.

## Limitations

The empty block reflects a provider representation rather than a PostgreSQL
requirement. A future provider release may normalize absent settings correctly.
Validate its behavior before updating the provider pin.

## Removal

With an updated provider, create a disposable PostgreSQL user without the empty
block, then refresh and plan again. Once it produces no settings removal and an
unchanged apply makes no user update request, remove the explicit block and its
source comment together. Keep existing users and passwords.
