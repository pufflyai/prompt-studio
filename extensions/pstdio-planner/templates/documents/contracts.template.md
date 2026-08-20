---
user_prompt: "{{USER_PROMPT}}"
created: "{{CREATED_AT}}"
---

# Contracts

[What interfaces (HTTP, SDK, IPC, CLI, events) are touched by this ticket and the exact shapes each side must honor.]

## Surfaces

### [Contract name, for example `POST /v1/things`]

- Location: [File path or route definition]
- Callers: [UI, SDK, extension, or external client]

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
