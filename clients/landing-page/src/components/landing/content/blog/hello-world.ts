import type { DocPage } from "../../doc-view";

export const helloWorldPage: DocPage = {
  title: "Welcome to Prompt Studio!",
  meta: "2026-04-24 · ANNOUNCEMENTS · AURÉLIEN FRANKY",
  intro: "Prompt Studio is an agent orchestration framework you can extend to fit the way you work.",
  blocks: [
    { type: "paragraph", text: "To install or upgrade Prompt Studio run:" },
    { type: "code", code: "npm i -g pstdio@latest" },
    {
      type: "quote",
      text: "Prompt Studio is currently in alpha: expect breaking changes before it reaches beta. Any breaking updates will be announced on the blog.",
    },
    { type: "image", src: "/images/blog/screenshot-pst.png", alt: "Prompt Studio screenshot" },
    { type: "heading", text: "What is Prompt Studio?" },
    {
      type: "paragraph",
      text: "Lately, my time to code has been limited. That forced me to think very carefully about how to get more done with less hands-on time. Coding agents help but only up to a point. Once you start running multiple agents in parallel, things get messy:",
    },
    {
      type: "list",
      items: [
        "errors compound",
        "context drifts",
        "outputs diverge from your intent",
        "reviewing everything becomes tricky",
      ],
    },
    { type: "paragraph", text: "**Prompt Studio exists to solve that.**" },
    { type: "paragraph", text: "It helps you manage fleets of agents (coding or otherwise) by:" },
    {
      type: "list",
      items: [
        "aligning them with how you work",
        "giving you visibility into what they produce",
        "making it easier to guide, review, and iterate on their output",
      ],
    },
    { type: "heading", text: "Why build another tool?" },
    { type: "paragraph", text: "There are already tools in this space, like Conductor or Vibe Kanban." },
    {
      type: "paragraph",
      text: "And chances are, if you've been working with agents for a while, **you've probably built something yourself to fill the gaps**.",
    },
    { type: "paragraph", text: "So why build another one?" },
    { type: "paragraph", text: "Because none of the existing tools quite fit the way I wanted to work." },
    {
      type: "paragraph",
      text: "We're still early in figuring out what a good “agentic workflow” looks like. The problem is that most tools:",
    },
    {
      type: "list",
      items: [
        "bake in strong opinions about how you should work",
        "optimize for a fixed workflow",
        "make experimentation harder instead of easier",
      ],
    },
    {
      type: "paragraph",
      text: "That's a tough trade-off: **the more a tool tries to help, the more it risks getting in your way.**",
    },
    { type: "heading", text: "App or Framework?" },
    {
      type: "paragraph",
      text: "Prompt Studio takes a different approach: instead of being a fully opinionated app, it's **a framework you (or your coding agent) can build on top of**.",
    },
    { type: "paragraph", text: "Every project can have its own extensions:" },
    {
      type: "list",
      items: [
        "a custom panel tailored to that codebase",
        "custom actions in the ui or cli",
        "project-specific automations",
        "extensions that reflect your workflow",
      ],
    },
    {
      type: "paragraph",
      text: "These are some of the extensions I've built for myself on top of Prompt Studio:",
    },
    {
      type: "list",
      items: [
        "open vscode in a specific worktree",
        "trigger an automated review when an agent finishes an implementation",
        "add a custom button to open a pull request on GitHub",
        "launch Storybook directly from the workspace",
        "automatically capture a screenshot after frontend changes",
      ],
    },
    {
      type: "paragraph",
      text: "These help me with my particular workflow, but it would make no sense for these to be part of the core platform.",
    },
    { type: "heading", text: "Work with the Harnesses you love" },
    { type: "paragraph", text: "Prompt Studio integrates with the Harnesses you already rely on:" },
    { type: "list", items: ["Claude Code", "Open Code"] },
    { type: "paragraph", text: "More are coming soon." },
    { type: "quote", text: "You'll need one of these installed locally to use Prompt Studio." },
    { type: "heading", text: "Try it" },
    { type: "paragraph", text: "Once the CLI is installed, run:" },
    { type: "code", code: "pstdio" },
    {
      type: "paragraph",
      text: "If you hit a bug or want to suggest an extension, the repo is on [GitHub](https://github.com/pufflyai/prompt-studio) — issues and PRs welcome. You can also join the conversation on [Discord](https://discord.gg/3RxwUEk8fW).",
    },
    { type: "heading", text: "What's next" },
    {
      type: "paragraph",
      text: "In the next post, I'll walk through how the SDK and CLI work and how you can start shaping Prompt Studio to match your workflow.",
    },
    { type: "paragraph", text: "Stay tuned!" },
  ],
};
