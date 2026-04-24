---
layout: ../../../layouts/docs-layout.astro
title: Use the SDK in scripts
description: Script against Prompt Studio with the TypeScript SDK.
htmlTitle: Use the TypeScript SDK
htmlDescription: Drive Prompt Studio from a script with @pstdio/sdk — list projects, create tickets, launch attempts, and stream sessions.
section: Guide
category: Automation
categoryOrder: 5
order: 1
---

## Install

```bash
bun add @pstdio/sdk
```

The SDK is TypeScript-first and works in Bun and Node 20+.

## Create a client

The SDK defaults to `http://localhost:19840` (the local API). For most scripts this is enough:

```ts
import { createClient } from "@pstdio/sdk/client";

const client = createClient();
```

Override the base URL or pass an auth token:

```ts
const client = createClient({
  baseUrl: process.env.PSTDIO_API_URL,
  token: process.env.PSTDIO_API_TOKEN,
});
```

See [Authentication](/docs/operations/ports-and-env/#authentication) for how the token flows to the API.

## Common scripts

### List projects

```ts
import { createClient } from "@pstdio/sdk/client";

const client = createClient();
const projects = await client.projects.list();

for (const project of projects) {
  console.log(`${project.shorthand} ${project.name}`);
}
```

### Create a ticket

```ts
await client.tickets.create({
  project_id,
  content: "# Add onboarding empty states\n\nUsers with no projects see a blank screen.",
  status_name: "backlog",
  tag_names: ["frontend"],
});
```

### Launch an attempt

```ts
const attempt = await client.tickets.createAttempt(ticketId, {
  agent: "claude-code",
  mode: "worktree",
  start_session: true,
});

console.log("session id", attempt.session?.id);
```

### Follow up on a session

```ts
await client.sessions.followUp(sessionId, {
  content: "Tighten error handling around the new endpoint.",
});
```

### Stream a session

The session stream is exposed over SSE. Use fetch directly or any SSE client:

```ts
const response = await fetch(`${baseUrl}/v1/sessions/${sessionId}/stream`, {
  headers: token ? { authorization: `Bearer ${token}` } : undefined,
});

for await (const chunk of response.body!) {
  process.stdout.write(chunk);
}
```

## Error handling

Every failing request throws a `PstdioApiError`:

```ts
import { PstdioApiError } from "@pstdio/sdk/client";

try {
  await client.tickets.get("missing-id");
} catch (err) {
  if (err instanceof PstdioApiError) {
    console.error(err.status, err.message);
  } else {
    throw err;
  }
}
```

## Related pages

- [`client` reference](/docs/reference/sdk/client/) — every method, signature, and route.
- [API overview](/docs/reference/api/overview/) — raw HTTP if you're not using the SDK.
