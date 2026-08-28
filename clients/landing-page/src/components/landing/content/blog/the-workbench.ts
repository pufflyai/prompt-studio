import type { DocPage } from "../../doc-view";

export const theWorkbenchPage: DocPage = {
  title: "Meet the workbench",
  meta: "2026-07-21 · ANNOUNCEMENTS · AURÉLIEN FRANKY",
  intro:
    "Since the first release, one idea has taken over Prompt Studio: your tools should adapt to you, not the other way around.",
  blocks: [
    {
      type: "paragraph",
      text: "Every team works with agents differently — a kanban board, a terminal, a review ritual no product has heard of. Most tools answer the same way: here is our workflow, please adapt. We're all still figuring out what working with agents should feel like, and a tool that locks in a workflow today is locking in today's guesses. So we rebuilt Prompt Studio around a different idea: **the workbench**.",
    },
    { type: "heading", text: "What a workbench is" },
    {
      type: "list",
      items: [
        "The surface where your work happens: resources on one side, editors and views in the middle, your agent right beside them.",
        "Nothing about it is fixed — when a view, button, automation, or whole panel is missing, you describe it to your agent and it becomes part of your project.",
        "Your team can see it, change it, and keep it.",
      ],
    },
    { type: "heading", text: "Placement is function" },
    {
      type: "list",
      items: [
        "Like a physical bench, **where something is placed decides what it does** — there's nothing to register and nothing to configure.",
        "A view in the sidebar becomes part of your project's navigation.",
        "Instructions in a project are followed by every agent working there.",
        "An extension in a repository ships with the code, so everyone who clones the project gets the same tools.",
      ],
    },
    { type: "heading", text: "What that looks like today" },
    {
      type: "list",
      items: [
        "Your data is no longer trapped in files — tickets, runs, results open as a table you can sort, filter, and actually read.",
        "A real terminal lives in your workspace, with tabs that survive a restart and are named after whatever is running inside them.",
        "The workbench remembers where you were, what you had open, and how you split your panels.",
      ],
    },
    { type: "heading", text: "Build your own" },
    {
      type: "list",
      items: [
        "The same foundation is now a standalone package, so you can build a tool for your own domain and let it grow through extensions the same way.",
        "If you build something with it, I'd genuinely love to see it.",
      ],
    },
    { type: "heading", text: "Your agents, your choice" },
    {
      type: "list",
      items: [
        "Codex support landed alongside Claude Code and OpenCode.",
        "Tune each run — the model, how hard it thinks — per task, without changing the agent that writes your code.",
      ],
    },
    { type: "heading", text: "What's next" },
    {
      type: "paragraph",
      text: "The foundation is in place; now comes the interesting part — seeing what people build on it. If you hit a bug or wish something existed, the repo is on [GitHub](https://github.com/pufflyai/prompt-studio). Or come tell me what you're building on [Discord](https://discord.gg/3RxwUEk8fW).",
    },
    { type: "paragraph", text: "To try the workbench, install or upgrade Prompt Studio:" },
    { type: "code", code: "bun add -g pstdio@latest && pst" },
    {
      type: "quote",
      text: "Prompt Studio is currently in alpha: expect breaking changes before it reaches beta. Any breaking updates will be announced on the blog.",
    },
  ],
};
