# Resource path opening and rich message bubbles

Status: Proposed. Implementation is under review; Planner adoption follows the SDK release.

## Product need

A file link in a conversation currently opens in the workspace browser, even when
an extension owns that file. Opening a ticket draft should take the person to the
ticket. Opening a saved ticket document should select that document in Planner.
People should see a resource bubble with the owner's label and icon in the message.

The host owns path normalization, owner selection, navigation dispatch, and shared
message presentation. Extensions own the paths they handle, resource identity,
labels, icons, and destinations. The host must not contain ticket-specific routing.

## Requirements

- Resource kinds may claim workspace-relative path prefixes and name an owner command.
- Match complete path segments. The longest matching prefix wins.
- Normalize relative, absolute, and file-URL links against the conversation's workspace,
  preserving source positions and the existing workspace-boundary checks.
- Pass the normalized path and conversation workspace ID to the owner command.
- Accept a resource and page, panel, or compound destination. Qualify local references
  with the owner and project, and reject foreign resources throughout page, panel,
  parent, and compound destinations.
- Open unclaimed paths and missing resources through the existing workspace flow.
  Report resolver failures when the link is opened.
- Render local links in read-only rich messages as resource bubbles. Resolve owner
  labels, icons, and page URLs without changing the stored message.
- Use the shared resource icon registry, with the resource kind's icon as the default.
  Show the icon with the resolved label. Bubbles have no tooltip or underline, including on hover.
- Keep explicit web references on the native web-opening path, with mouse and keyboard activation.
- Apply source positions to page destinations and every page in compound destinations,
  replacing any competing section while retaining parent navigation.
- Detect ordinary file paths in prose without agent-specific link formatting.
  Support Markdown links, inline-code file references, and explicit reference links too.
  Preserve keyboard activation, web links, source positions, and editable Markdown.
- Keep completed bubbles stable while more text streams. Ignore late presentation
  results after a link changes or its view closes.
- Let agents invoke the same owner command through the existing command API.

## Schema

The public contribution extends `ResourceKindDefinition` from `@pstdio/sdk/extensions`:

```ts
paths?: readonly {
  readonly prefix: string;
  readonly resolve: CommandRef;
}[];
```

The host publishes normalized extension metadata:

```ts
paths?: {
  prefix: string;
  resolveCommand: string; // Qualified command ID from the same owner.
}[];
```

The command receives `{ path: string, workspaceId: string }` as its second argument.
It returns `ResourceResolution | null`. A non-null path resolution must include
`resource` and a page, panel, or compound `target`. A page target keeps the link's
line and column position. The existing `ResourceRef` and navigation contracts apply.

The signature authority is the [public contribution type](../../../packages/pstdio-api-contracts/src/extension-kernel/types/composition.ts).
The [extension metadata schema](../../../packages/pstdio-api-contracts/src/extensions/workbench-metadata.ts)
validates the transport shape. This is an additive API change with no database
schema change, stored message rewrite, or migration.

## Acceptance

1. Open a ticket draft link from a conversation while another workspace is selected.
   Resolve it using the conversation's workspace and open the ticket in Planner.
2. Open a saved ticket file path and select the corresponding document by its stable ID.
3. Prefer a more specific path claim and do not match a sibling directory with a similar name.
4. Open an unclaimed file through the workspace browser. Reject an outside-workspace
   path and a resolver result from another resource owner or project.
5. Share a plain ticket or saved-document path in prose and show its owner label and
   icon without requiring any link syntax. Support Markdown, inline-code, and explicit
   reference bubbles too. Activate them by keyboard and preserve ordinary web links.
6. Stream more text without recreating earlier bubbles. Edit Markdown without
   replacing its source with resolved labels or URLs.
7. Load an independent extension's declaration through the packaged host, expose
   its qualified resolver in metadata, and invoke it through the command API.

## Delivery

Ship the host, SDK, message UI, schema, and packaged contract coverage first.
Ship Planner's path declarations and resolver in a separate extension PR after
the SDK is published. Keep that PR marked `waiting-for-release` until its published
dependency checks pass. See the [extension release rules](../../../extensions/AGENTS.md).

## Non-goals

New resource relationship storage, content access grants, cross-project file
resolution, a file editor registry, and changing the workspace file browser.
Durable relationships remain covered by [general resource linking](0006-resource-linking.md).

## Mission test

Extensions choose how their own files become usable resources, while people get
one consistent link interaction. Agents use the same public commands. The shared
host supplies plumbing without taking ownership of extension content or navigation.
