---
user_prompt: "{{USER_PROMPT}}"
created: "{{CREATED_AT}}"
---

# Contracts

<!-- Use for proposal review when interface shapes affect the decision, and refine during implementation. Use concise bullets and compact examples. Keep only relevant surfaces and sections. Mark existing and proposed shapes clearly; link inspected source for existing behavior. -->

- [Which interfaces (HTTP, SDK, IPC, CLI, events) change and why their shapes matter.]

## Surfaces

### [Contract name, for example `POST /v1/things`]

- Location: [File path or route definition]
- Callers: [UI, SDK, extension, or external client]
- Status: [Existing or proposed; link the current definition when available.]

#### Request

```ts
// method / path / headers
// body shape
```

#### Response

```ts
// success shape
// status codes
```

#### Errors

| Status | Error code / message | Cause |
| ------ | -------------------- | ----- |
| [code] | [message]            | [when this fires] |

## Invariants

- [Ordering guarantees, idempotency, auth requirements, rate limits]

## Backward compatibility

- [What existing callers assume and how this change affects them]

## Design choices

- [Why this shape was chosen, a meaningful alternative, and the cost or limitation.]
- [Material assumption or unresolved choice that affects review.]
