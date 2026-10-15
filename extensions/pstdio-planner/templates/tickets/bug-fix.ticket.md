---
ticket_id: "{{TICKET_ID}}"
user_prompt: "{{USER_PROMPT}}"
created: "{{CREATED_AT}}"
parent_id: "{{PARENT_ID}}"
depends_on: []
blocked_reason: ""
---

# {{TICKET_TITLE}}

**Reproduced**: [Yes / No]

[One sentence: what goes wrong and who it affects.]

## Reproduction

**Environment**: [OS, app version, commit, local or production]

1. [Step, starting from a clean state]

**Expected**: [What should happen]

**Actual**: [What happens instead, with the exact error text]

## Proof

- [Error output, log lines, failing test output, or a screenshot in this ticket's files]

## Cause

**[Confirmed / Hypothesis]**: [What causes the bug, with code references]

## Fix

[The proposed fix in a few sentences.]

| Option     | Fixes the cause | Trade-off |
| ---------- | --------------- | --------- |
| [Proposed] | [Yes / No]      | [...]     |

**Temporary fix**: [No / Yes, see files/adr.md]

**Regression test**: [The test that fails today and passes after the fix]
