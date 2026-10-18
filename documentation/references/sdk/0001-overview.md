# Overview

`@pstdio/sdk` is the public TypeScript package for Prompt Studio. It contains the extension API, the HTTP client, resource types, and prompt helpers.

Install it with:

```sh
bun add @pstdio/sdk
```

The package is ESM-only and has no root entry point. Import one of its subpaths.

Install the SDK version that matches your Prompt Studio app, such as `bun add @pstdio/sdk@0.43.1` for app 0.43.1. The SDK provides types and helpers; the app decides which APIs exist at run time. Updating the SDK does not update the app. The SDK reference follows the source on `main` and marks APIs that the current stable release does not have. See [App, SDK, and extension API versions](../extensions/0014-api-versioning.md#app-sdk-and-extension-api-versions).

## Entry points

| Entry point | Purpose |
| --- | --- |
| `@pstdio/sdk/extensions` | Contribution helpers, typed refs, command and renderer contexts, storage contracts, and the webview client |
| `@pstdio/sdk/extensions/react` | React Query hooks for webviews: `useCommandQuery` and `useCommandMutation` |
| `@pstdio/sdk/client` | The HTTP client for the Prompt Studio API: `createClient` and `PstdioApiError` |
| `@pstdio/sdk/api` | HTTP request and response types |
| `@pstdio/sdk/resources` | [Resource types](0002-resources.md) such as `Project`, `Workspace`, and `Session` |
| `@pstdio/sdk/prompts` | `renderPrompt(template, data)` for Mustache prompt templates |
| `@pstdio/sdk/hooks` | Deprecated filesystem-hook contexts; use typed hooks from `/extensions` |
| `@pstdio/sdk/data` | Draft layout, frontmatter, and ID or name lookup helpers |
| `@pstdio/sdk/testing` | Command contexts and in-memory storage, file, and resource adapters for extension tests |

`requireRepoFiles` from `/data` is also deprecated in 0.44. Planner and Reports keep using it until
the named extension file handle from PRD 0009 ships and they adopt its published SDK. The pure
frontmatter, draft-layout, name-resolution and prompt-rendering helpers remain supported.

Every entry except `@pstdio/sdk/extensions/react` works without React. That entry needs the optional peer dependencies `react` (19) and `@tanstack/react-query` (5). The type declarations include every type they reference, so they also type-check with `skipLibCheck: false`.

The [method reference](0003-api.md) lists the client groups and what each entry exports.

## Where to start

Extension authors should start with the [workbench cookbook](../../guides/extensions/0002-workbench-cookbook.md) and [Extension Lab](../../../extensions/extension-lab/README.md). These examples use public contracts for editing, persistence, inspectors, shared mode panels, and navigation. The [Extension API](../extensions/0001-api.md) reference covers every contribution.

Scripts and services that call a running Prompt Studio use `@pstdio/sdk/client`. See the [client guide](../../guides/sdk/0001-client.md).

People who build their own host app on the workbench should read the [Workbench](../workbench/0001-overview.md) reference. Host registries and layout controllers are not extension authoring APIs.
