---
user_prompt: "{{USER_PROMPT}}"
created: "{{CREATED_AT}}"
---

# Architecture overview

[Summarize the technical approach in one to three sentences.]

## Design summary

[Describe the proposed technical design without repeating the ticket goals.]

## Current architecture

- [Relevant current component/service/module]
- [Relevant limitation]
- [Relevant dependency]

## Proposed architecture

- [New or changed component]
- [New or changed responsibility]
- [New or changed integration]

## Component responsibilities

| Component   | Responsibility   | Change   |
| ----------- | ---------------- | -------- |
| [Component] | [Responsibility] | [Change] |

## Data and state changes

| Data / State | Owner   | Change   | Notes   |
| ------------ | ------- | -------- | ------- |
| [Data/state] | [Owner] | [Change] | [Notes] |

## APIs, events, and contracts

| Contract              | Producer / Owner | Consumer   | Change   |
| --------------------- | ---------------- | ---------- | -------- |
| [API/event/interface] | [Owner]          | [Consumer] | [Change] |

## Key decisions

### Decision: [Title]

| Choice     | Reason   | Cost or consequence |
| ---------- | -------- | ------------------- |
| [Decision] | [Reason] | [Cost]              |

## Reliability, security, and operations

| Area        | Design                                      |
| ----------- | ------------------------------------------- |
| Reliability | [Retries, timeouts, and failure handling]   |
| Security    | [Authentication, permissions, private data] |
| Operations  | [Logs, metrics, traces, and alerts]         |

## Deployment and rollout

[List the rollout steps in order. Include rollback or cleanup.]

## Technical risks

| Risk                            | Mitigation   |
| ------------------------------- | ------------ |
| [Technical or operational risk] | [Mitigation] |

## Open questions

- [Question]
