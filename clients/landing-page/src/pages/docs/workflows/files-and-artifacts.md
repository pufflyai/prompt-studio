---
layout: ../../../layouts/docs-layout.astro
title: Attach files and artifacts
description: Add context files to a ticket, and understand the artifacts produced by agent runs.
htmlTitle: Files and artifacts
htmlDescription: Attach context files to a Prompt Studio ticket and locate the artifacts agents leave behind after a run.
section: Guide
category: Daily Workflow
categoryOrder: 3
order: 3
---

## Files vs artifacts

Every ticket has two file buckets:

- **Files** — user-provided context (screenshots, specs, input CSVs). Uploaded through the dashboard or the API, stored server-side and mirrored under `.pstdio/tickets/<shorthand>/files/`.
- **Artifacts** — outputs produced during an agent run (logs, generated docs). Kept locally under `.pstdio/tickets/<shorthand>/artifacts/` and not uploaded by default.

## Upload a file

### Dashboard

Open the ticket, drag-and-drop into the **Files** section or click the upload button.

### SDK

```ts
import { createClient } from "@pstdio/sdk/client";

const client = createClient();

await client.tickets.uploadFile(ticketId, {
  name: "design-mock.png",
  mime_type: "image/png",
  content: await Bun.file("./design-mock.png").arrayBuffer(),
});
```

### Local file

Drop the file into `.pstdio/tickets/<shorthand>/files/` and run:

```bash
pstdio tickets save --id <shorthand>
```

## List and download

```bash
pstdio tickets files --id PS-42
```

Via the SDK:

```ts
const files = await client.tickets.listFiles(ticketId);
const content = await client.tickets.getFileContent(ticketId, fileId);
```

`getFileContent` returns a `Uint8Array` — wrap it in a Node `Buffer` or Bun `Response` for disk or network writes.

## Delete a file

```ts
await client.tickets.deleteFile(ticketId, fileId);
```

Or delete the local copy and re-save — `pstdio tickets save` only uploads, it does not delete.

## Artifacts

Agents drop artifacts under `.pstdio/tickets/<shorthand>/artifacts/`. They are intentionally kept local — they often contain full conversation dumps or intermediate logs. Commit the ones that matter to your team; gitignore the rest.

## Related pages

- [Local ticket files](/docs/workflows/local-ticket-files/) — the folder layout.
- [`client.tickets` reference](/docs/reference/sdk/client/#clienttickets) — file methods in the SDK.
