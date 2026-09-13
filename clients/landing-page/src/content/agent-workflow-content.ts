export const AGENT_WORKFLOW_EXAMPLES = [
  {
    kind: "command",
    title: "Ticket commands",
    description: "Actions you or your agent can run to keep the board up to date.",
    examples: [
      {
        title: "Create a ticket",
        detail: "Add a title, describe the work, and choose an initial status.",
        code: 'pst tickets create --content "# Add a color picker" --status "Queued"',
      },
      {
        title: "Update ticket status",
        detail: "Move a ticket to In progress when work starts, then Ready for review when the change is ready.",
        code: 'pst tickets update --id TOOL-16 --status "Ready for review"',
      },
      {
        title: "List tickets",
        detail: "Find the next ticket to work on or see which changes need review.",
        code: 'pst tickets list --status "Queued"',
      },
    ],
  },
  {
    kind: "skill",
    title: "Agent skills",
    description: "Reusable instructions that teach agents how to handle your tickets.",
    examples: [
      {
        title: "Implement a ticket",
        detail:
          "Read the ticket and related code. Set the ticket to In progress, make the change, run the checks, and record the result before moving it to Ready for review.",
      },
      {
        title: "Review a change",
        detail:
          "Compare the change with the ticket requirements. Check the tests and edge cases, then add findings and update the ticket status.",
      },
    ],
  },
  {
    kind: "automation",
    title: "Scheduled work",
    description: "Run the same workflow at a time you choose.",
    examples: [
      {
        title: "Pick up queued tickets · Every weekday at 09:00",
        detail:
          "List queued tickets, choose the next unblocked ticket, and start an agent with the Implement a ticket skill.",
      },
      {
        title: "Prepare a review summary · Every weekday at 16:00",
        detail: "List tickets ready for review and summarize their changes, checks, and open questions.",
      },
    ],
  },
] as const;
