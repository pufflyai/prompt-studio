# Social radar

A repo-local tool for daily marketing research. It reads sites, saves useful threads, drafts replies, and suggests posts. You post everything yourself.

1. Enable Social radar and the Codex harness in project extensions. Your Codex account must have `gpt-6-astra`.
2. Log in to X and LinkedIn in the browser that Codex computer use drives.
3. Open **Social radar** under Tools, then **Settings**. Edit topics, competitors, writing voice, and each site's targets and search budget. Clear a field to remove an item; use the empty field to add one.
4. Click **Run now**. Read the session and digest. Sites that cannot be read appear as skipped.
5. Copy a draft, paste and post it yourself, then choose **Mark posted** or **Mark used**. Open **Manage threads** to revise saved threads, including the draft reply and posted outcome.

The schedule runs at 07:00 in the host machine’s local time. The app must be running; startup catches up once for the latest missed slot. Disable it in project automations. Run now uses the same command as the schedule. An active run blocks another run; the next run closes sessions that ended without a digest.

```sh
pst social-radar run-daily
pst social-radar list-digest
pst social-radar list-posted
pst social-radar set-thread-status --id <id> --status posted
pst social-radar get-settings
pst social-radar update-site --site reddit --targets r/ClaudeAI,r/LocalLLaMA --budget 2
pst social-radar update-thread --id <id> --input '{"draftReply":"A clearer reply"}'
```

The agent calls the same commands as the page. Structured inputs use `--input '<JSON>'`; see the shipped [skill](skills/social-radar/SKILL.md). Threads, ideas, and runs live in project-scoped extension storage. Browser credentials stay in the browser.

Search budgets cap the skill's work, including failed requests and follow-ups. They are self-reported, since the host cannot count browser actions. Free endpoints may reject requests. The skill uses browser fallback within budget and reports login walls, captchas, or missing browser tools. If the Codex harness is unavailable, the run fails with the host's error. No other harness is used.
