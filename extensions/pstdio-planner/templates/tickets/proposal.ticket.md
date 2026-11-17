---
ticket_id: "{{TICKET_ID}}"
user_prompt: "{{USER_PROMPT}}"
created: "{{CREATED_AT}}"
parent_id: "{{PARENT_ID}}"
depends_on: []
blocked_reason: ""
---

# {{TICKET_TITLE}}

<!-- Use concise bullets. A reader should quickly understand the outcome, reason, and mechanism. Keep simple proposals here; link supporting files only when they help review. Remove comments and unused optional sections. -->

- [What users can do after this ships.]

## Why

- [What is broken or missing today, and why it should change now.]

## How

- [Explain the mechanism and main component or workflow changes. Do not just repeat the goal.]
- [Link technical design, API shapes, schemas, or research when they need separate review.]

## Downsides

<!-- Optional: omit when no concrete cost, limitation, or trade-off helps the decision. -->

- [A concrete cost, limitation, or remaining trade-off.]

## Scenarios

<!-- At most five. Put the rest in files/scenarios.md. -->

### Scenario: [Title] (Priority: P1)

> **Given** [state], **When** [action], **Then** [outcome]

Repeat the scenario section for each distinct behavior.

## Not doing

- [What this proposal leaves out]
