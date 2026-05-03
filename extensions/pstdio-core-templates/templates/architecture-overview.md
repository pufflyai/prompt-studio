---
user_prompt: "{{USER_PROMPT}}"
created: "{{CREATED_AT}}"
---

# Architecture Overview

[1–3 sentences summarizing the technical approach.]

## Design Summary

[Describe the proposed technical design without repeating the ticket goals.]

## Current Architecture

- [Relevant current component/service/module]
- [Relevant limitation]
- [Relevant dependency]

## Proposed Architecture

- [New or changed component]
- [New or changed responsibility]
- [New or changed integration]

## Component Responsibilities

| Component   | Responsibility   | Change   |
| ----------- | ---------------- | -------- |
| [Component] | [Responsibility] | [Change] |

## Data & State Changes

| Data / State | Owner   | Change   | Notes   |
| ------------ | ------- | -------- | ------- |
| [Data/state] | [Owner] | [Change] | [Notes] |

## APIs, Events, and Contracts

| Contract              | Producer / Owner | Consumer   | Change   |
| --------------------- | ---------------- | ---------- | -------- |
| [API/event/interface] | [Owner]          | [Consumer] | [Change] |

## Key Decisions

### Decision 1 — [Title]

**Decision:** [Decision]

**Rationale:** [Reason]

**Trade-off:** [Cost or consequence]

## Reliability, Security, and Observability

- **Reliability:** [Retries, timeouts, failure handling]
- **Security:** [Auth, permissions, sensitive data]
- **Observability:** [Logs, metrics, traces, alerts]

## Deployment & Rollout

1. [Rollout step 1]
2. [Rollout step 2]
3. [Rollback or cleanup step]

## Architecture-Specific Risks

- [Technical or operational risk]
- [Mitigation]

## Open Architecture Questions

- [Question]
