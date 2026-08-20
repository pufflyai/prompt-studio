---
ticket_id: "{{TICKET_ID}}"
user_prompt: "{{USER_PROMPT}}"
created: "{{CREATED_AT}}"
parent_id: "{{PARENT_ID}}"
depends_on: []
parallelizable: "[no|yes]"
blocked_reason: ""
---

# {{TICKET_TITLE}}

[Describe the change and its user-visible outcome in one to three sentences.]

## Why

[Describe the problem or opportunity. What is broken or missing today? Why should it change now?]

## Goals

- [Outcome]

### Non-goals

- [What is explicitly not included]

## User scenarios and acceptance

### Scenario: [Title] (Priority: P1)

> **Given** [state], **When** [action], **Then** [outcome]

Repeat the scenario section for each distinct behavior.

## Implementation outline

[List the implementation phases in order.]

## Product changes

- [Affected feature, workflow, screen, integration, or capability. Do not list code paths here.]

## Assumptions

- A1: [Assumption]

## Risks and open questions

- [Potential issue, conflict, discrepancy, risk, or unanswered question]
