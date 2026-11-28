Read and follow this document before starting work:

- [Requirement book](documentation/requirement-book/README.md), then the Mission and product boundaries rules (RB1) in [the canonical book](documentation/requirement-book/book.json).
- Run agent tests primarily in configured cloud workspaces, including focused tests and `test:review`. Follow the `run-cloud-tests` or `run-tests-remotely` skill. Use local execution only when cloud is unavailable or cannot run the required workload, and record why. Native desktop tests run in GitHub Actions when the selected workspace has no desktop session; use `--desktop-in-ci` and retain the candidate’s CI evidence. See [005.9.8](documentation/guidance/0005-testing.md#9-targeted-validation-and-repairs).

## Work guidance

| Guide                                                                                   | When to use                                                                 |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| [Design](documentation/guidance/0002-design.md)                                         | Changing UI or interaction patterns.                                        |
| [Nonfunctional requirements](documentation/guidance/0003-nonfunctional-requirements.md) | Planning changes or checking performance and resource limits.               |
| [Pull requests and CI](documentation/guidance/0004-ci.md)                               | Opening, reviewing, or finishing a PR, or investigating CI failures.        |
| [Testing and validation](documentation/guidance/0005-testing.md)                        | Every change, before choosing and running checks.                           |
| [Engineering](documentation/guidance/0006-engineering.md)                               | Before writing or changing code.                                            |
| [Contributing](documentation/guidance/0007-contributing.md)                             | Before writing a change or working with Git.                                |
| [Planning and documentation](documentation/guidance/0008-planning.md)                   | Writing plans, tickets, documentation, architecture decisions, or messages. |
| [Troubleshooting](documentation/guidance/0009-troubleshooting.md)                       | Diagnosing bugs, failed checks, unexpected behavior, or a blocked approach. |

## Rule references

- Cite product intent by its stable RB (Core) or RBE (Extensions) identity. Guidance procedure references use `document.section.rule`.
- Follow the [numbering format](documentation/guidance/0008-planning.md#5-rule-references).

## Review handoffs

- Post handoffs for review or delivery as comments in the ticket’s Activity. Use [Action, Status, and Evidence](documentation/guidance/0008-planning.md#7-review-handoff-comments) and keep the comment to 80 words, excluding evidence links. Reserve Planner review requests for unresolved decisions that need an answer.
