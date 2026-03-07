---
ticket_id: "{{TICKET_ID}}"
user_prompt: "{{USER_PROMPT}}"
created: "{{CREATED_AT}}"
status: "{{STATUS}}"
parent_id: "{{PARENT_ID}}"
priority: "[P1|P2|P3]"
complexity: "[low|medium|high]"
depends_on: []
parallelizable: "[no|yes]"
blocked_reason: ""
---

# {{TICKET_TITLE}}

[What this ticket accomplishes, in one paragraph.]

## References

[Link to relevant docs/specs when available. If none exist, note the gap.]

- [Reference link or note]

## Scope

### In Scope

- [Included work]
- [Tests required to validate work (or explicitly "none")]
- [Documentation updates required or explicitly none]

### Out of Scope

- [Explicitly excluded work]

## Implementation Notes

[Describe the approach, key files/modules, assumptions, and include code snippets.]

- [Key files/modules to touch]
- [Assumptions or gaps]

```ts
[Insert relevant planned code changes.]
```

## Documentation

[Describe documentation updates required or state "No documentation updates required."]

## Steps

- [ ] Red - [Add/expand tests in `path/to/test` for specific cases.]
- [ ] Green - [Implement minimal code to satisfy the tests.]
- [ ] Refactor - [Simplify, remove legacy code, improve structure.]
- [ ] Docs - [Update docs if needed.]
- [ ] Validation - [Run required commands and capture artifacts.]

## Acceptance

- [ ] [Outcome 1 pass/fail condition]
- [ ] [Outcome 2 pass/fail condition]
- [ ] [Outcome 3 pass/fail condition]
- ...

## Evidence

[Point to artifacts under `.pstdio/tickets/<ticket-id>_<slug>/artifacts/`. The artifacts must include a way to recreate the outputs (e.g. commands used).]

- [build outputs, test outputs, screenshots, traces, curl responses]
