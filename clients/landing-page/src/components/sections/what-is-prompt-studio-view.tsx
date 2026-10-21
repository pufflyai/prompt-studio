import { DocColumn } from "../workbench/doc-column";

export const WhatIsPromptStudioView = () => (
  <DocColumn pageKey="/what-is-prompt-studio/">
    <h1>What is Prompt Studio?</h1>
    <p>
      A workbench for the tools you wish existed. Describe what you need, let a coding agent build it, and use it beside
      your other tools.
    </p>
    <h2>Start with a gap in your own work</h2>
    <p>
      A reading list beside your notes. A review checklist that follows your team’s process. A panel that brings the
      right information together before a meeting. Small tools can make a real difference when they fit the way you
      work.
    </p>
    <p>
      You know where your current tools fall short. Prompt Studio gives you a place to build something that fits, try it
      in your daily work, and keep changing it as your needs change. You can direct an agent without writing the
      extension code yourself.
    </p>
    <h2>Give your tools a place to live</h2>
    <p>
      Every tool needs somewhere to appear, a way to save its data, and a way to let you know when something needs
      attention. Prompt Studio supplies those shared foundations, along with a place for your agents to work.
    </p>
    <p>
      Your tools are <a href="/docs/guides/concepts/extensions/">extensions</a>. Install existing ones, such as Notes or
      Planner, or ask an agent to build your own. Each project keeps the tools and settings you choose for it.
    </p>
    <h2>Build it, try it, change it</h2>
    <p>
      Work with <a href="/docs/guides/getting-started/run-agents/">Claude Code, Codex, or OpenCode</a>. You install and
      sign in to the agent you want to use. Describe the result, let it build a tool, and try the result in the
      workbench. Ask for changes in the same conversation. The tool stays in your project, ready to use again.
    </p>
    <h2>Tools that can work together</h2>
    <p>
      An extension can expose the same actions to its page and the command line. A person can use the screen; an agent
      can use a command. Tool authors connect the actions and data they want to share, so a small tool can become part
      of a larger workflow.
    </p>
    <p>
      See <a href="/how-does-it-work/">how it works</a>, or follow the guide to{" "}
      <a href="/docs/guides/getting-started/add-tools/#ask-an-agent-to-build-your-tool">build your first tool</a>.
    </p>
    <h2>Where the idea comes from</h2>
    <p>
      Read <a href="/blog/welcome-to-prompt-studio/">Welcome to Prompt Studio</a> for the problem that started it, and{" "}
      <a href="/blog/users-in-the-development-team/">From malleable software to Prompt Studio</a> for the idea behind
      tools that people can reshape with agents.
    </p>
  </DocColumn>
);
