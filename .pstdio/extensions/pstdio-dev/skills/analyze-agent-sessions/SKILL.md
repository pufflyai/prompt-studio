---
name: analyze-agent-sessions
description: "Classify past agent sessions as successes or failure modes, then turn repeated failures into skill and documentation proposals. Use when asked to review sessions, find why agents fail, or improve agent guidance from history."
metadata:
  version: 0.1.1
---

# analyze-agent-sessions

Prompt Studio keeps every agent session. This skill reads them, decides what went wrong, and proposes guidance so future agents avoid it. You judge the sessions; Session insights in the Prompt Studio Dev extension (`pstdio.dev`) stores your verdicts and groups them.

The vocabulary lives in the extension. Read it before you classify anything:

`pst pstdio.dev insights taxonomy`

## 1. Find sessions to judge

```sh
pst pstdio.dev insights scan                              # first pass over new or changed sessions
pst pstdio.dev insights list --needs-review --limit 20    # sessions the first pass could not settle
```

The first pass is only triage. It is reliable for infrastructure failures (usage limits, lost connections) and weak at everything else. A `success` from heuristics only means nobody complained in a recognizable phrase.

## 2. Judge one session

```sh
pst pstdio.dev insights transcript --session-id <id>
```

The digest lists each turn: the user's request, tool failure counts with samples, errors, and the agent's first and final replies. Long sessions omit middle turns.

Decide in this order:

1. **What did the user want?** Read the first request and any later re-statement of it. One session can hold several requests. Judge the main one, and add other modes with `--secondary-modes`.
2. **Did they get it?** Look at the final turns. Acceptance, moving on to an unrelated request, or a merged PR count as success. A correction, a repeated request, "still failing", or a cancel right after a claim of success count against it.
3. **What was the first thing that went wrong?** Name the root cause, not the last symptom. An agent that misread the task and then looped is `misread_intent`, not `stuck_or_looping`.
4. **Was it the agent?** Usage limits, network loss and harness crashes are `infra_failure`. Flaky CI that the agent handled well is not a failure. Flaky CI that the agent "fixed" by changing unrelated config is `unwanted_action`.

Outcome rules:

- `success`: the user got what they asked for. Minor follow-ups that add new scope are fine.
- `partial`: the user had to correct, re-explain, nudge ("continue") or finish part of the work.
- `failed`: the goal was not reached, or the work was reverted or redone.
- `unclear`: you cannot tell. Do not guess `success` for silent cancels.

Write the verdict:

```sh
pst pstdio.dev insights classify --session-id <id> \
  --outcome partial \
  --failure-mode unwanted_action \
  --evidence 'User: "why are you switching mirror? don'"'"'t do that this is probably an intermittent issue!"' \
  --lesson "Preserve the failing run and diagnose its owning phase. Do not switch package mirrors for an intermittent outage or retry unchanged failures to obtain a pass; follow current CI policy and explicit task instructions." \
  --remediation docs \
  --remediation-target AGENTS.md \
  --confidence high
```

- `--evidence` quotes the transcript: the user's words, an error, or the agent's false claim. A reader must be able to verify the verdict from it alone.
- `--lesson` is an instruction to a future agent, written as a rule with its reason, specific to this project. "Be more careful" is not a lesson. "Run the affected package checks and required local review before readiness; preserve failed or unrun work as unfinished" is.
- `--remediation-target` names where the lesson belongs: a skill name (`implement-ticket`), a doc path (`documentation/guidance/0004-ci.md`), `AGENTS.md`, or a script. Reuse the same target string across sessions so the report can group them.

Work in batches. After each batch of 10, re-read the `list` output; earlier verdicts often reveal a pattern you can check for in the rest. If subagents are available, give each a disjoint list of session IDs and these instructions.

Also spot-check a few heuristic successes (`pst pstdio.dev insights list --outcome success --source heuristic`). Reclassify any that are not.

## 3. Turn failures into guidance

```sh
pst pstdio.dev insights report --agent-only
```

The report groups failures by mode, then lists the fix targets and lessons reviewers gave. Open the saved Markdown at the returned `path`.

For each failure mode with **three or more sessions**, or any single severe failure (lost work, destructive actions):

1. **Merge the lessons.** Lessons that share a target usually state one rule in different words. Write it once, keep the strongest reason, and cite the session IDs.
2. **Check what already exists.** Read the current target (the skill's `SKILL.md`, the guidance doc, `AGENTS.md`). If the rule is already there, the problem is placement or wording: agents did not read or did not apply it. Propose moving it to where the agent is at that moment, such as the skill for that task, rather than repeating it.
3. **Pick the right container:**
   - **Skill**: a procedure for a recurring kind of task (release, implement a ticket, fix CI) with its steps, checks and stop conditions. Fits `false_completion`, `premature_stop` and `stuck_or_looping`.
   - **Project docs or AGENTS.md**: a standing rule or fact that applies to all tasks. Fits `unwanted_action`, `knowledge_gap` and `misread_intent`.
   - **Tooling**: a script, check or setup fix when the failure is mechanical. Fits `environment_tooling`. A doc that says "remember to run X" is weaker than a check that runs X.
   - **Nothing**: infrastructure modes. List recurring harness errors for a bug report instead.
4. **Draft the change.** Write complete text, ready to paste: a new `SKILL.md` with frontmatter (`name`, a `description` that says when to use it), or the exact paragraph to add with the heading it goes under. Keep rules short, give each one its reason, and include the command or check that proves it was followed.

Save the proposals next to the report, in the extension's folder:

`.pstdio/extension-storage/pstdio.dev/proposals/<date>-<target>.md`

Each proposal states the target file, the failure mode, the evidence (session IDs and one quote each), and the full proposed text.

## 4. Hand back

Do not edit `AGENTS.md`, `CLAUDE.md`, skills or docs in the repository unless the user asked you to. Summarize for the user:

- outcome counts and the top failure modes, with session counts;
- each proposal: target, one-line rule, and how many sessions it would have prevented;
- taxonomy gaps: sessions you marked `other` that share a cause, with a suggested new mode.
