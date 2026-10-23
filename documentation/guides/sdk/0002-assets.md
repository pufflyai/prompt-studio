# Immutable assets

Stage large files as immutable assets. Prompt Studio streams their bytes and verifies their size and checksum. Records refer to completed assets.

## Availability

`ctx.storage.assets` and `client.assets` are on `main` and in `0.44.0-nightly` builds. They ship in the release after 0.43.x. `@pstdio/sdk` 0.43.1 and the 0.43.1 app do not have them.

You need both a new SDK and a new app. Updating `@pstdio/sdk` alone gives you the types, but the 0.43.x runtime does not provide the methods or their API routes. On 0.43.x, use `ctx.storage.files` and collection attachments, described in [Existing blobs](#existing-blobs). See [App, SDK, and extension API versions](../../references/extensions/0014-api-versioning.md#app-sdk-and-extension-api-versions).

## Extension commands

Use `ctx.storage.assets` from commands and hooks:

```ts
const asset = await ctx.storage.assets.stage({
  operationId: pendingWork.uploadId,
  source: file, // Blob or File
});
await ctx.storage.assets.verifyComplete([asset]);
```

Keep the operation ID with pending work. Reuse it with the same source after interruption or restart. The host resumes from the bytes already stored. Changing the content or media type for that operation fails.

The result contains only `{ sha256, byteLength, mediaType }`. It contains no local path, URL, or credential. Its owner is the current workbench and installed extension. Storage scopes and collections share that asset owner; choose operation IDs that are unique across the extension's work in that workbench.

`getTransfer(operationId)` returns `staging`, `complete`, or `cancelled`, or `undefined` for an unknown operation. A staging result includes `uploadedByteLength`. Staged bytes cannot be read as a completed asset.

## Scripts and other clients

```ts
import { createClient } from "@pstdio/sdk/client";

const client = createClient({ baseUrl, token });
const owner = { projectId, extensionInstanceId };
const asset = await client.assets.upload({
  ...owner,
  operationId: pendingWork.uploadId,
  source: file,
  signal,
  onProgress: (uploadedByteLength) => console.log(uploadedByteLength),
});
```

The client hashes the source as a stream and sends bounded chunks. A lost acknowledgement resumes from the server's stored offset. It makes up to three transfer attempts for connection failures, server errors, or changed offsets. Exhausted attempts leave the transfer available for the next call. Aborting the request preserves progress; it does not cancel the stored operation.

The owner is resolved from the installed extension in that project. Caller-supplied account identifiers do not grant access. The local runtime's normal authentication applies.

## Read and cancel

`ctx.storage.assets.read(asset)` and `client.assets.read({ ...owner, asset, signal })` return a `ReadableStream<Uint8Array>`. Consume it to its end before treating the download as verified. A truncated or corrupted download fails the stream. Pipe it to a file or another streaming consumer to avoid buffering the whole asset.

Call `ctx.storage.assets.cancel(operationId)` or `client.assets.cancel({ ...owner, operationId })` for explicit cancellation. This stops an active upload and removes its temporary bytes. Cancelling never removes a completed asset. A cancelled operation ID cannot be reused.

Keep an asset readable by referencing it from a record. Do not rely on an asset that no record references staying available, and do not use assets as version history. Verifying assets does not commit a group of records or show that an entire workbench is ready offline.

## Existing blobs

`ctx.storage.files`, collection attachments, and existing webview file calls keep their signatures and file IDs. Their HTTP uploads and downloads now stream through local storage. `getBytes()` still returns a complete byte array when the caller explicitly needs one. Use immutable assets for versioned content and resumable transfers; existing mutable blob IDs are not portable asset references.

Project cleanup removes its mutable blobs and preserves immutable asset versions.
