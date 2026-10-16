# Resource-owned related openings

Proposed: 2026-10-16

Status: Accepted.

## Context

The workbench's automatic linked-kind scan guesses which resources should open. Ticket needs its latest session. Workspace needs a terminal and its latest session. Other extensions need to define their own choices without host-specific branches.

## Decision

Add an optional `relatedOpenings` command reference to the defining resource kind. The command receives the source and returns ordered resource references with `autoOpen`, destination, and preview/pin intent. Only explicit `autoOpen: true` opens a target.

Targets keep their normal presentation resolvers. Workbench applies shared opening, source-focus protection, cancellation, and tray retention. Automatic results do not recurse.

Keep the existing default-on global switch. Add no customization editor, named rule catalog, override preferences, or database fields. Existing manual links and resource resolution APIs remain supported.

Expose activity ordering and qualified anchor filtering through the public session query. First-party extensions use that SDK contract.

## Consequences

Resource owners control domain choices. People retain normal pinning, movement, and the global switch. Agents use the same public commands.

Several returned previews aimed at one tray replace in order, leaving the last eligible result. No conflict editor is needed. Existing targets retain their actual tray and pins.

Publish the additive SDK contract before adopting it in independently released extensions. See the [API reference](../references/extensions/0018-related-resource-openings.md).

## Alternatives

- Scan every linked kind: this keeps domain policy in the host.
- Add Ticket/Workspace branches to Workbench: third-party owners cannot use the same path.
- Add named rules and overrides: this exceeds the API-only scope.
- Return imperative navigation callbacks: focus and cancellation become unreliable.
- Make sources reference target view internals: targets already own their presentation.
