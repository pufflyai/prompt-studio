import type { ReviewRequestView } from "../../src/data/review-request-types";
import type { AutoBuildSession } from "../../src/timeline/view/auto-build-session-row";

// Synthetic records for the isolated design preview. Nothing is saved to Planner.
const request = (id: string, ticketId: string, title: string, instructions: string, options: string[]) =>
  ({
    id,
    ticketId,
    title,
    instructions,
    request: {
      kind: "decision",
      questions: [
        {
          id: "solution",
          label: "Which solution should the agent use?",
          required: true,
          input: {
            kind: "single-choice",
            options: options.map((label, index) => ({ id: `option-${index}`, label })),
          },
        },
      ],
    },
    requestedAt: "2026-11-03T10:00:00.000Z",
    requestedBy: { type: "agent", id: "demo-builder", displayName: "Builder" },
    context: { reason: null, workspaceId: null, attemptRevision: null, sessionId: null, relatedSessionId: null },
    state: "open",
    outcome: null,
    outcomeText: null,
  }) satisfies ReviewRequestView;

export const previewRequests = [
  request(
    "demo-backup",
    "demo-notes",
    "DEMO-12 · Back up offline notes",
    "**Problem:** Clearing browser data deletes offline notes.\n\n**Solutions:** Offer a backup file (recommended), or keep notes in the browser.\n\n**Downsides:** Backups need a saved file. Browser-only notes cannot be recovered.",
    ["Offer a backup file (recommended)", "Keep notes only in this browser"],
  ),
  request(
    "demo-sharing",
    "demo-notes",
    "DEMO-12 · Choose who can read shared notes",
    "**Problem:** A public link could expose private notes.\n\n**Solutions:** Invite people (recommended), or allow anyone with the link.\n\n**Downsides:** Invites require sign-in. Public links can be forwarded.",
    ["Invite specific people (recommended)", "Allow anyone with the link"],
  ),
  request(
    "demo-import",
    "demo-importer",
    "DEMO-21 · Choose the first import format",
    "**Problem:** The importer needs a file format for its first release.\n\n**Solutions:** Start with CSV (recommended), or include Excel too.\n\n**Downsides:** CSV requires exporting spreadsheets. Excel support takes longer.",
    ["Start with CSV (recommended)", "Support CSV and Excel together"],
  ),
];

export const previewAgentSessions: AutoBuildSession[] = [
  { id: "demo-notes-agent", title: "DEMO-12 · Build the notes tool", status: "awaiting_input" },
  { id: "demo-import-agent", title: "DEMO-21 · Build the importer", status: "in_progress" },
];
