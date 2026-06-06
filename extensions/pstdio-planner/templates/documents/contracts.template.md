---
user_prompt: "{{USER_PROMPT}}"
created: "{{CREATED_AT}}"
---

# Contracts

[What interfaces (HTTP, SDK, IPC, CLI, events) are touched by this ticket and the exact shapes each side must honor.]

## Surfaces

### [Surface name — e.g. `POST /v1/things`]

- **Where it lives**: [file path or route definition]
- **Consumers**: [who calls it — UI, SDK, extension, external client]

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

## Backwards Compatibility

- [What existing callers assume and how this change affects them]
