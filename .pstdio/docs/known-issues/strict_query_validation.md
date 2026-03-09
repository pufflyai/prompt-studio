# Strict Query Validation on API Endpoints

## Problem

API route definitions use `z.object({}).strict()` for query validation. This rejects **any** query parameter not explicitly declared in the schema, returning a 400 ZodError.

Adding cache-buster params like `?_ts=...` or `?v=...` to API URLs will silently break the request. The frontend receives a 400 response, which can surface as permanently stuck loading states.

## Why it exists

Hono's `@hono/zod-openapi` validates the full query string against the declared schema. When `.strict()` is used on an empty object (`z.object({}).strict()`), every query parameter is treated as an unrecognized key.

## Risk

High. The failure mode is silent — no console error in the browser, and the API returns a valid JSON error body that can be missed during development. E2E tests may time out waiting for content that never loads.

## Prevention

- Do **not** add query parameters to API URLs unless the route schema explicitly declares them.
- Use `cache: "no-store"` in fetch options for cache busting instead of query params — the `Cache-Control` header achieves the same goal without touching the URL.
- If a route genuinely needs query params, add them to the route's `request.query` Zod schema.
