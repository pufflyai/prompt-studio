---
user_prompt: "{{USER_PROMPT}}"
status: "[Proposed | Accepted | Deprecated | Superseded]"
created: "{{CREATED_AT}}"
---

# ADR: {{TITLE}}

[What problem are we solving? What constraints, requirements, or incidents led here?]

## Decision

[What are we choosing to do? Be explicit and testable.]

## Rationale

[Why this decision? Include tradeoffs and decision drivers.]

## Alternatives Considered

1. **[Alternative A]**: [why rejected]
2. **[Alternative B]**: [why rejected]

## Consequences

### Positive

- [What gets better?]

### Negative / Risks

- [What gets worse or harder?]

## Migration / Rollout Plan

[How do we move from the current state to the decided state? Include any sequencing.]

## Verification & Evidence

_Goal: the decision’s impact is verifiable by an LLM through execution + concrete outputs._

- **Commands to run**: [exact commands]
- **Expected evidence**: [logs, HTTP responses, screenshots/videos/traces, artifacts]
- **Where to find artifacts**: [paths, URLs, container/log sources]

## Follow-ups

- [TODO items, owners, deadlines]
