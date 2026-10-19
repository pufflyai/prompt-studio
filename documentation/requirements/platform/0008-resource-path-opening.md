# Resource path opening and rich message bubbles

Status: Partly delivered. Host, SDK, and message UI support is published in 0.44.0. Planner, Notes, and Artifacts adoption is in review. See the [delivery record](#delivery-record).

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
- Apply source positions to page destinations and every page in compound destinations
  that open a document, replacing any competing section while retaining parent navigation.
  A page that opens no document keeps the owner's destination without the position.
- Detect ordinary file paths in prose without agent-specific link formatting.
  Support Markdown links, inline-code file references, and explicit reference links too.
  Paths found in prose or inline code are guesses. Show one as a bubble only when its owner
  resolves it or the file exists in the conversation workspace; otherwise keep the text as written.
  Markdown links and explicit references stay links even when the file is missing.
  Preserve route-group parentheses and dynamic path segments; never turn a path suffix into a different file link.
  Preserve keyboard activation, web links, source positions, and editable Markdown.
- Copying a message keeps every bubble's text and formatting in both plain text and HTML.
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
   Keep text such as `origin/main`, github.com and Node.js, and paths to missing files,
   as plain text or code.
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

## Delivery record

Checked on 2026-10-19 against main commit `2527821f`. The newest stable release is `pstdio@0.44.0`.

| Part | State | Record |
| --- | --- | --- |
| Host path claims and resolution | Delivered in source | #1155, merged 2026-10-17. Longest whole-segment matching, owner and project qualification, and fallback live in `packages/pstdio-dashboard/src/modules/sessions/chat/resource-path-resolution.ts` and `session-link-handler.ts`. Metadata normalization lives in `packages/pstdio-extensions/src/runtime/normalize/`. |
| SDK and metadata schema | Delivered in source | `paths` on `ResourceKindDefinition` and the metadata schema, as listed under Schema above. Published in `@pstdio/sdk@0.44.0`. |
| Message UI | Delivered in source | Resource bubbles and prose path detection in `packages/ui/src/components/chat-ui/links/` and `packages/ui/src/components/rich-text/shared/`. |
| Packaged contract | Delivered in source | `packages/e2e/src/packaged/packaged-resource-links-smoke.ts` loads an independent fixture declaration and calls its resolver through the command API. |
| Planner declarations and resolver | In review | #1156 adds them and passes `published_extensions` against 0.44.0. It finds a ticket by shorthand without reading every ticket. |
| Notes and Artifacts declarations and resolvers | In review | #1240 claims note `content.md` files and artifact snapshot files. |
| Guards and legacy cleanup | Not in scope here | Planner guards and the removal of old anchor methods belong to [general resource linking](0006-resource-linking.md#delivery-record). |

Acceptance 3, 4, 6, and 7 have unit or packaged test coverage. That is not an end-to-end user journey. On 2026-10-19, a manual Playwright check in an isolated dev stack with #1156 and #1240 applied opened a ticket draft path, a note path, and an artifact snapshot path from a session message, each with its owner label and icon. It did not cover saved ticket documents or a conversation in another workspace.

A claimed path with a line number, such as `.../documents/<note-id>/content.md:3`, used to fail with "Page location has an invalid source position", because the host added the position to every page target. Since #1242 (PS-835), the host applies a position only to pages that open a document, and other pages open without it.

Evidence: unit tests, passed locally on 2026-10-18: `resource-path-resolution.test.ts` (owner resolution, icon override, longest prefix, fallback, foreign identity rejection, compound targets, source positions). Message UI tests such as `chat-text-link-transform.test.ts` and the packaged smoke run in CI and were not rerun here.
