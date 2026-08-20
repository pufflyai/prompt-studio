---
ticket_id: "{{TICKET_ID}}"
user_prompt: "{{USER_PROMPT}}"
created: "{{CREATED_AT}}"
parent_id: "{{PARENT_ID}}"
depends_on: []
parallelizable: "no"
blocked_reason: ""
---

# {{TICKET_TITLE}}

<!-- before writing this ticket, reproduce the bug as a user would -->

[One paragraph describing the bug, who is affected, and the expected outcome after the fix ships.]

## Reproduction summary

- **Status**: [Reproduced / Intermittent / Could not reproduce]
- **Environment**: [OS, browser/app version, branch/commit, local/prod/staging / Unknown]
- **Frequency**: [Always / Sometimes / Once / Unknown]
- **First observed**: [Date or approximate time / Unknown]
- **Affected area**: [Feature, page, command, integration, or workflow / Unknown]

## Steps to reproduce

[List the exact reproduction steps in order.]

## Expected behavior

[What should happen.]

## Actual behavior

[What happens instead. Include exact error messages when available.]

## Evidence

Attach bug-reproduction planning files under this ticket's files, then link them here. Put validation output from implementation or review in a workspace report under `.pstdio/reports/<name>/`.

- Screenshot: [file name or link]
- Screen recording: [file name or link]
- Logs/trace: [file name or link]

## Impact

- **Severity**: [Low / Medium / High / Critical / Unknown]
- **Users affected**: [Who or how many / Unknown]
- **Workaround**: [Available workaround / Unknown]

## Technical notes

[Relevant code paths, recent changes, suspected cause, related tickets, or debugging notes.]

## Acceptance criteria

- [ ] The bug is reproduced by an automated regression test where applicable.
- [ ] The issue no longer occurs using the reproduction steps above.
- [ ] Existing behavior outside the reported bug remains unchanged.
- [ ] Documentation or release notes are updated if user-facing behavior changes.
