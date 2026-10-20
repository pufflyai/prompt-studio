---
user_prompt: "{{USER_PROMPT}}"
status: "proposed"
created: "{{CREATED_AT}}"
---

# Product requirements

<!-- Describe what the product does and why, not how it is built. Ask open questions in a review request on the ticket, not here. -->

[One or two sentences: what users can do, and who they are.]

## Why

[What is broken or missing today, and why it matters. At most three sentences.]

## Scenarios

### Scenario: [Title] (Priority: P1)

> **Given** [state], **When** [action], **Then** [outcome]

Repeat the scenario section for each distinct behavior.

## Rules

- [A rule that must always hold, written so a test can check it]

## Interface

<!-- Only for features that people or extensions call directly. Delete this section otherwise. -->

```text
[CLI command, API request and response, or event, with a short example]
```

## Not doing

- [What these requirements leave out]
