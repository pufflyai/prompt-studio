---
user_prompt: "{{USER_PROMPT}}"
created: "{{CREATED_AT}}"
---

# Architecture overview

<!-- Use concise bullets. Keep sections that help review this design and omit the rest. Link inspected source beside current-behavior claims. Mark proposed components and unverified assumptions clearly. -->

- [Summarize the technical mechanism and scope.]

## Design summary

- [Explain how the design works, rather than repeating the ticket goals.]

## Current architecture

- [Relevant current component/service/module, with inspected source reference.]
- [Current execution path, limitation, and dependency that motivate the change.]

## Proposed architecture

- [New or changed component and its inputs, outputs, and interactions.]
- [Concrete execution path from the user's action or system trigger to the result.]
- [State ownership and lifecycle: creation, updates, and cleanup.]

## Architecture diagrams

<!-- For substantial architecture changes, add meaningful Mermaid diagrams of current/proposed relationships. Label interactions, distinguish new components, and use sequence or state diagrams when ordering or lifecycle matters. Validate syntax and agreement with the explanation. Omit for a bounded change when a brief How explains it. -->

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

- [Show a small request/response, interface, event, or data example when it explains a consequential choice.]
- [Explain important constraints, errors, compatibility, and migration implications. Link contracts.md or schemas.md when shapes need separate review.]

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

- [Explain rollout order, compatibility during transition, rollback, and cleanup when relevant to the decision. Leave coding tasks to implementation tickets.]

## Technical risks

| Risk                            | Mitigation   |
| ------------------------------- | ------------ |
| [Technical or operational risk] | [Mitigation] |

## Open questions

- [Material assumption, limitation, or unresolved choice and its effect. Ask the person only when a choice needs their authority.]
