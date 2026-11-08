# Project composition

Configure a project's default page and resource openers through the public API.

Extension API 0.4 and its matching workbench/tool consumers arrive in the coordinated
alpha release. Use the candidate SDK for development and a published compatible SDK
before releasing a consumer.

```ts
import { createClient } from "@pstdio/sdk/client";

const client = createClient({ baseUrl: "http://localhost:5000" });
const composition = await client.projects.composition("project-id");
await client.projects.setComposition("project-id", {
  defaultPage: { kind: "page", extensionId: "example.space", id: "desk" },
  resourceOpeners: [{
    resourceKind: { kind: "resource-kind", extensionId: "pstdio", id: "workspace" },
    opener: { kind: "command", extensionId: "example.reader", id: "inspect" },
  }],
});
void composition;
```

`setComposition` replaces the configuration. An explicit empty list and a null
default remain empty. References identify ordinary contributions; enabling a tool
preserves an explicit project choice. Configuration shares the existing synced
project-information document. Writes require valid, fully qualified references.
If synced configuration cannot be decoded or does not match the supported schema,
metadata and configuration reads return an empty composition without changing the
stored value. An explicit valid replacement restores the choices. Distribution
defaults apply only when no composition is stored.

The CLI uses the same endpoints: `pst projects composition` reads configuration,
and `--value '<json>'` replaces it. Pass `--project-id` outside a linked project.

Use `ctx.resources.resolveOpenings(refs)` in an extension or
`client.projects.resolveResourceOpenings(projectId, refs, { signal })` in an API
client. Each result includes the canonical resource and, when available, a normal
page, panel, or compound target. The selected opener can belong to another extension
than the data owner. A configured command reads `ctx.resource` and returns its target.
Missing openers and disabled targets leave the operation unavailable. Source and
returned resource kinds, the opener, and every destination must remain enabled
when resolution finishes. Ownership checks include resources in panel targets,
page parents, and compound members. Caller references from another project return
HTTP 400; an invalid returned target is omitted without rejecting other openings.

Extension lookups stop when their invocation returns or is cancelled. A pending read cannot
continue into another host lookup or opener after that boundary. Anchor validators
retain their link-mutation restrictions when resolution calls another tool.

`resolveMany` continues to resolve data-owner metadata. A declared resource kind
does not need a batch resolver to use a configured opener. Explicit navigation
targets retain their own destination and context.

An optional `relatedOpenings` command reference in a binding selects
`RelatedResourceOpenings` through the workbench's existing preview preferences.
The consumer owns that policy; core retains resource identity and authorization.
