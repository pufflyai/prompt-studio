# Strict Query Validation on API Endpoints

## Problem

API routes that use a strict query schema reject parameters not declared in that schema. For example, `z.object({}).strict()` rejects every query parameter, while the [workspace diff-summary route](../../packages/pstdio-api/src/features/workspaces/endpoints/get-workspace-diff-summary.ts) accepts only its declared `mode` parameter.

Adding cache-buster params like `?_ts=...` or `?v=...` to API URLs will silently break the request. The frontend receives a 400 response, which can surface as permanently stuck loading states.

## Why it exists

Hono's `@hono/zod-openapi` validates the full query string against the declared schema. When `.strict()` is used on an empty object (`z.object({}).strict()`), every query parameter is treated as an unrecognized key.

## Risk

A caller that ignores the error response can leave the UI loading indefinitely. E2E tests may then time out waiting for content, hiding the original HTTP 400.

## Prevention

- Do **not** add query parameters to API URLs unless the route schema explicitly declares them.
- If browser HTTP caching must be bypassed, use `cache: "no-store"` in fetch options. Refresh any application query cache through its own API.
- If a route genuinely needs query params, add them to the route's `request.query` Zod schema.
