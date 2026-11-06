# Append-only logs

Logs hold immutable entries such as comments, run events and device history. Declare each log in the extension definition, then use `ctx.storage.log`. This API is part of the unreleased PS-1016 change and requires matching host and SDK builds.

```ts
export default defineExtension({
  storage: {
    logs: ["comments", { name: "runs", writer: "device", keep: { days: 30 } }],
  },
});

const comments = ctx.storage.log("comments");
const entry = await comments.append({ body: "Shipped" }, { id: eventId });
const page = await comments.read({ after: 0, limit: 50 });
const next = await comments.read({ after: page.cursor, limit: 50 });
```

The host selects the current extension and project owner. The optional `scope` uses the same project or resource scope as structured storage. A log must be declared; a published command's existing write permission also covers appending.

`append` persists locally before returning and works offline. It returns `{ id, writerId, createdAt, value }`. Omit `id` to generate one. Reusing an ID with the same value on its original device is an idempotent retry; reusing it with another value fails. Entries cannot be updated or removed individually. Large entries use encrypted payload blobs; the existing record and record-group size limits are unchanged.

String declarations use `writer: "project"`. Every device can append, and canonical entries follow relay order. An offline append appears immediately; reconnecting settles its canonical position. Reading onward does not repeat an entry already shown optimistically.

`writer: "device"` gives each device an independent stream. Readers discover every stream in that owner and scope. A device never waits for another writer to append. Each stream preserves its own order; the combined reader interleaves available streams by entry time and a stable tie-break. Only the stream's writer publishes its snapshots.

Pages contain `entries`, an opaque `cursor`, and `more`. The default limit is 50 and the supported range is 1–1,000. Pass the returned cursor to the same log and scope; do not decode it or use it as an authorization token. A page downloads only its selected payloads, including when older entries have been compacted. `read({ newest: true, limit: 50 })` selects the newest page and returns a cursor suitable for following later entries.

```ts
const controller = new AbortController();
for await (const entry of comments.follow({ after: page.cursor, signal: controller.signal })) {
  showComment(entry.value);
}
```

Following uses local and relay notifications. Abort the signal when the reader closes. Reconnection uses the saved cursor and immutable identities. Unopened histories do not download because another log changes.

`keep.days` must be positive and finite. Retention filters old entries on each device, and authenticated page metadata lets a new reader skip expired payloads without downloading them. Retention applies to a log's entries rather than changing record or asset budgets.

For SDK tests, pass the same declaration to `createMemoryStorage({ logs: extension.storage.logs })` or `createMemoryStorageDevices({ logs: extension.storage.logs })`. The two-device helper preserves project relay order and independent device writers.
