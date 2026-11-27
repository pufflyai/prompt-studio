# Agent Quotas

Install Agent Quotas from the extension catalog; it is off by default. It shows how much of one agent's 5-hour and weekly allowance is left in the status bar, next to Performance Monitoring:

```
⌛ Claude 5h 62% · wk 80%
```

Select it to see every quota window of that agent, when each one resets, a forecast at the current pace, and a refresh button. The dropdown at the top chooses which agent the status bar follows.

## Providers

Claude Code, Codex, GitHub Copilot, OpenCode and Pi. Each harness extension exposes the same `quotas` command, which this extension calls. The dropdown lists the harnesses turned on in the current project. The choice is saved per project; when the saved harness is turned off, the first one still on is shown.

Only the selected harness is read. Claude Code answers by starting a short process with no prompt, so a read never starts a conversation. While the status bar is visible it asks again every minute; the extension answers from its saved reading, and reads the harness again once that reading is 5 minutes old or a window has reset. Nothing is read while Prompt Studio is hidden. Missing or failed reads show `–` rather than a full allowance, and are tried again after a minute.

## Forecast and colors

The forecast is the straight-line projection Home uses: the share used from the start of the window until now, carried on to the reset. It is not shown during the first tenth of a window, where one burst would project far too high.

Each value takes the worse color of what is left now and where the current pace leads:

| Color  | When                                                                                       |
| ------ | ------------------------------------------------------------------------------------------ |
| Muted  | More than 20% left and not on pace to run out                                              |
| Orange | 20% or less left, or on pace to use 100% or more before the reset                          |
| Red    | 5% or less left, or on pace for 125% or more, so it runs out with a fifth of the window left |

## Commands

People and agents use the same commands:

```sh
pst pstdio.agent-quotas status --json            # reuses a reading younger than 5 minutes
pst pstdio.agent-quotas status --refresh --json  # always reads again
pst pstdio.agent-quotas refresh
pst pstdio.agent-quotas select --provider harness-codex
```
