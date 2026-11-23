/**
 * The one copy of the outcome and failure-mode vocabulary. The table, the CLI, the
 * heuristics and the review skill (through `pst ... taxonomy`) all read it from here.
 */

export const outcomes = {
  success: "The agent did what was asked, and the user accepted it or moved on without correcting it.",
  partial: "Some of the request landed, but the user had to correct, re-explain or finish part of it.",
  failed: "The request was not achieved, or the result had to be reverted or redone.",
  infra_failure: "The run ended for reasons outside the agent's behavior, such as usage limits or lost connections.",
  unclear: "The transcript does not show whether the work succeeded, for example a silent cancel.",
  in_progress: "The session is still running or waiting for input. It is not judged yet.",
} as const;

export type Outcome = keyof typeof outcomes;
export const outcomeIds = Object.keys(outcomes) as Outcome[];

export type Remediation = "skill" | "docs" | "tooling" | "harness" | "none";

export type FailureModeDefinition = {
  label: string;
  description: string;
  /** Observable signs a reviewer can quote as evidence. */
  signals: string;
  /** The usual fix that stops future agents from repeating it. */
  remediation: Remediation;
  fixHint: string;
};

export const failureModes = {
  misread_intent: {
    label: "Misread intent",
    description: "Solved a different problem than the one asked, or picked the wrong interpretation.",
    signals: "User re-explains the goal: 'not what I meant', 'I asked for', 'no, I want'.",
    remediation: "docs",
    fixHint: "Add guidance on restating ambiguous requests, or document the project's terms and their meaning.",
  },
  unwanted_action: {
    label: "Unwanted action",
    description: "Did something the user did not want: workarounds, scope creep, config changes, destructive steps.",
    signals: "'don't do that', 'why are you …', 'revert', 'undo', closing PRs the agent opened.",
    remediation: "docs",
    fixHint:
      "Write an explicit rule (with the reason) in AGENTS.md or the relevant skill, such as 'never switch mirrors for intermittent failures'.",
  },
  false_completion: {
    label: "False completion",
    description: "Claimed the work was done or green, but it was broken, unverified or incomplete.",
    signals: "'still failing', 'doesn't work', 'how is this possible', user finds failing checks after 'Done'.",
    remediation: "skill",
    fixHint:
      "Add a verification checklist to the task's skill: which commands prove the work, and what to report when they cannot run.",
  },
  premature_stop: {
    label: "Premature stop",
    description: "Stopped, asked or handed back before the task was finished without a real blocker.",
    signals:
      "User sends 'continue', 'resume', 'do not stop until …', or answers a question the agent could have answered itself.",
    remediation: "skill",
    fixHint: "State the completion criteria and which decisions the agent may take alone in the task's skill.",
  },
  stuck_or_looping: {
    label: "Stuck or looping",
    description: "Repeated failing attempts with no new information; burned time and tokens without progress.",
    signals: "Many failed tool calls, the same command retried, long sessions that end without a result.",
    remediation: "skill",
    fixHint: "Document the known failure and its fix, or add a troubleshooting step that says when to stop and report.",
  },
  knowledge_gap: {
    label: "Knowledge gap",
    description: "Did not know a repo convention, API, command or tool, and had to be told or guessed wrong.",
    signals: "User explains how things work here; agent searches widely for something the docs could state.",
    remediation: "docs",
    fixHint: "Add the missing fact to the docs or a skill reference, at the place an agent will read it.",
  },
  environment_tooling: {
    label: "Environment or tooling",
    description: "Builds, tests, CI, credentials or local setup blocked progress, not the agent's reasoning.",
    signals: "Missing dependencies, flaky CI, auth failures, commands that need setup nobody wrote down.",
    remediation: "tooling",
    fixHint: "Fix the script or setup, or document the setup step and its error message in troubleshooting docs.",
  },
  poor_communication: {
    label: "Poor communication",
    description: "The work may be fine, but the user could not tell what happened or what was left.",
    signals: "'did you …?', 'what is the status', user asks for a summary the final reply should have had.",
    remediation: "docs",
    fixHint: "Specify the final report format: what changed, how it was verified, and what was left undone.",
  },
  infra_usage_limit: {
    label: "Usage limit",
    description: "The provider's usage, rate or quota limit ended the run.",
    signals: "Errors such as 'You've hit your 5-hour limit' or 'Model access is disabled'.",
    remediation: "none",
    fixHint: "Not an agent behavior problem. Consider splitting long tasks or scheduling them after resets.",
  },
  infra_connection: {
    label: "Connection lost",
    description: "Network or worker loss ended the run.",
    signals: "ECONNRESET, ENOTFOUND, 'Connection lost', disconnected status, worker_lost exits.",
    remediation: "harness",
    fixHint: "Report recurring cases against the harness or host. No agent guidance needed.",
  },
  infra_harness: {
    label: "Harness error",
    description: "The harness or host failed: crashes, conflicting writers, interrupted steps.",
    signals: "'already has an active writer', crash or timeout errors not caused by the task.",
    remediation: "harness",
    fixHint: "File a harness bug with the session ID.",
  },
  user_cancelled: {
    label: "Cancelled",
    description: "The user stopped the session and the transcript shows no clear reason.",
    signals: "Cancelled status or user_stop exit with no correction before it.",
    remediation: "none",
    fixHint: "Review a sample by hand; recurring silent cancels often hide another mode.",
  },
  other: {
    label: "Other",
    description: "None of the above fits. Describe the mode in the evidence and lesson.",
    signals: "Anything new. Propose a taxonomy addition if it repeats.",
    remediation: "docs",
    fixHint: "If three or more sessions share it, add a new failure mode here.",
  },
} as const satisfies Record<string, FailureModeDefinition>;

export type FailureMode = keyof typeof failureModes;
export const failureModeIds = Object.keys(failureModes) as FailureMode[];

export const isOutcome = (value: string): value is Outcome => Object.hasOwn(outcomes, value);
export const isFailureMode = (value: string): value is FailureMode => Object.hasOwn(failureModes, value);

export const failureModeLabel = (mode: string | null | undefined) =>
  mode && isFailureMode(mode) ? failureModes[mode].label : "";
