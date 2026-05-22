# Extension Payloads

Extension payloads are typed through `@pstdio/sdk/extensions`.

Payloads use camelCase fields and include the project/resource identifiers needed to load richer state through the extension context APIs.

Use command contexts for command middleware and event payloads for lifecycle handlers. Do not rely on `.pstdio/plugins` hook context types; they are no longer part of the SDK.
