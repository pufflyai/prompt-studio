# TanStack DB `.select()` proxy strips fields

## What went wrong

After migrating from `@tanstack/react-query` to `@tanstack/react-db`, the dashboard crashed on every page with:

```
TypeError: Cannot read properties of undefined (reading 'split')
    at splitDateString (date-fns.js)
    at parseISO (date-fns.js)
```

`parseISO` was called with `undefined` because the `updated_at` field was missing from query results.

## Why

TanStack DB's query builder uses JavaScript Proxies in `.select()` callbacks. When the callback returns the proxy directly:

```ts
.select(({ t }) => t)
```

the proxy only records properties that were explicitly accessed through it. Since `updated_at` was never accessed on the proxy object itself (it was read later from the result), the proxy didn't include it in the output. The returned rows silently dropped every field that wasn't touched during the `.select()` call.

## How it was solved

Changed every `.select()` to use the spread operator:

```ts
.select(({ t }) => ({ ...t }))
```

The spread triggers the proxy's `ownKeys` trap, which adds `__SPREAD_SENTINEL__` markers. TanStack DB's query compiler detects these sentinels and emits a merge operation that includes all fields from the source table.

This fix was applied across all ~20 `useLiveQuery` calls in 7 hook files.

## Key takeaway

Never return a TanStack DB query proxy directly from `.select()`. Always spread it into a new object. This is documented in the [Streaming architecture](/architecture/stream) client section.
