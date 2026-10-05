# Social radar

A repo-local tool for daily marketing research. Every morning an agent reads sites, saves useful threads, marks the ones that mention Prompt Studio, drafts replies under the comments they answer, and suggests new posts. You post everything yourself.

1. Enable Social radar and the Codex harness in project extensions. By default the research agent is Codex with `gpt-6-astra`, which can read X and LinkedIn with computer use.
2. Log in to X and LinkedIn in the browser that Codex computer use drives.
3. Open **Social radar** under Tools. The analysis page opens, and the sidebar shows **Threads**, **Settings** and **Runs**. Threads are grouped as New (threads to join), Ideas (posts to publish), Answered and Skipped.
4. Open **Settings** in the sidebar. The section menu on its left holds **Research** (brand terms, topics, competitors and browse depth), **Voice** (the brand voice for every draft), **Agent** (the harness, model and model options; change them with **Choose model**) and **Channels**. Each channel has its own targets and daily search budget. Use **Add channel** to add a built-in site back or a new one with a link, and the trash icon to remove one.
5. Click the play button on **Runs**, or wait for the 07:00 run. Each run has its **Session** and a read-only **Digest**.
6. Open a thread. Copy a reply idea, post it yourself, then choose **Mark used** on the idea. Open the thread's actions and choose **Mark answered** so later runs can follow up. For a new post, post it, paste its link, and choose **Mark posted**.

The schedule runs at 07:00 in the host machine's local time. The app must be running; startup catches up once for the latest missed slot. Disable it in project automations. An active run blocks another run; the next run closes sessions that ended without finishing.

```sh
pst social-radar run-daily
pst social-radar list-analysis --days 14
pst social-radar list-digest
pst social-radar list-answered
pst social-radar set-thread-status --id <id> --status answered --url <posted-link>
pst social-radar add-media --threadId <id> --path shots/review-page.png
pst social-radar update-channel --id reddit --targets r/ClaudeAI --targets r/LocalLLaMA --budget 2
pst social-radar add-channel --name Lobsters --url https://lobste.rs
pst social-radar remove-channel --id lobsters
```

The agent calls the same commands as the pages. Structured inputs use `--input '<JSON>'`; see the shipped [skill](skills/social-radar/SKILL.md). Threads, reply ideas and runs live in project-scoped extension storage. Post media are files in the `post-media` folder of the extension storage, one folder per thread. Browser credentials stay in the browser.

Search budgets cap the skill's work, including failed requests and follow-ups. They are self-reported, since the host cannot count browser actions. Free endpoints may reject requests. The skill uses browser fallback within budget and reports login walls, captchas, or missing browser tools. If the chosen harness is unavailable, the run fails with the host's error. Custom channels have no search recipe or media rule: the agent reads them in the browser at their link, and their posts are text only.
