---
ticket_id: "{{TICKET_ID}}"
user_prompt: "{{USER_PROMPT}}"
created: "{{CREATED_AT}}"
parent_id: "{{PARENT_ID}}"
depends_on: []
blocked_reason: ""
---

# {{TICKET_TITLE}}

<!-- A reader should know within a minute what changes for users and why. Put detail in the ticket's files. -->

[One or two sentences: what users can do after this ships.]

## Why

[What is broken or missing today, and why it should change now. At most three sentences.]

## Scenarios

<!-- At most five. Put the rest in files/scenarios.md. -->

### Scenario: [Title] (Priority: P1)

> **Given** [state], **When** [action], **Then** [outcome]

Repeat the scenario section for each distinct behavior.

## Not doing

- [What this proposal leaves out]
