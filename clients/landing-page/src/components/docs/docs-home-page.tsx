import { SimpleGrid, Stack } from "@chakra-ui/react";
import {
  Blocks,
  BookOpen,
  Bot,
  ClipboardList,
  Code2,
  GitBranch,
  Layers,
  PanelRight,
  Play,
  Plug,
  Tags,
  Terminal,
} from "lucide-react";
import { DocsCard, ScreenshotFigure, SectionHeading } from "./docs-home-components";
import type { DocsSidebarItem } from "./docs-navigation";
import { DocsPageShell } from "./docs-page-shell";
import type { DocsSearchItem } from "./docs-search";

interface DocsHomePageProps {
  menuItems: DocsSidebarItem[];
  searchItems: DocsSearchItem[];
  next?: {
    href: string;
    title: string;
  };
}

const overviewMarkdown = `# Start with Prompt Studio

Prompt Studio is a local control plane for coding agents. Capture work as tickets, hand each one to a real agent CLI in an isolated git worktree, and keep the prompt, conversation, diff, and review status tied together — without losing what was tried, why, or how.

## Guide

- [What is Prompt Studio](/docs/start/what-is-prompt-studio/) — Who it is for, what it actually does, and the mental model.
- [Quickstart](/docs/start/quickstart/) — Install the CLI, create a project, set up an agent, and launch your first attempt.
- [Core concepts](/docs/concepts/workspaces-and-worktrees/) — Workspaces, worktrees, and the extension points behind the core loop.
- [Daily workflow](/docs/workflows/create-tickets/) — Create tickets, launch attempts, follow up, review diffs, and merge.

## References

- [SDK](/docs/reference/sdk/client/) — Client methods, plugin helpers, hooks, and prompt utilities.
- [CLI](/docs/reference/cli/global/) — Every command and option for projects, tickets, sessions, workspaces, agents, and more.
- [HTTP API](/docs/reference/api/overview/) — Local API routes, OpenAPI document, and authentication.

## What you work with day to day

The dashboard keeps tickets, attempts, session output, and review state visible while the CLI remains available for automation.

## Plan, delegate, review

Prompt Studio is built around a narrow loop that keeps each agent attempt understandable.

## Shape Prompt Studio around your repo`;

const guideLinks = [
  {
    title: "What is Prompt Studio",
    description: "Who it is for, what it actually does, and the mental model behind tickets and workspaces.",
    href: "/docs/start/what-is-prompt-studio/",
    icon: BookOpen,
  },
  {
    title: "Quickstart",
    description: "Install the CLI, create a project, set up an agent, and launch your first attempt.",
    href: "/docs/start/quickstart/",
    icon: Play,
  },
  {
    title: "Core concepts",
    description: "Workspaces, worktrees, and the extension points behind the core loop.",
    href: "/docs/concepts/workspaces-and-worktrees/",
    icon: GitBranch,
  },
];

const referenceLinks = [
  {
    title: "SDK",
    description: "Client methods, plugin helpers, hooks, and prompt utilities.",
    href: "/docs/reference/sdk/client/",
    icon: Code2,
  },
  {
    title: "CLI",
    description: "Every command and option for projects, tickets, sessions, workspaces, agents, and more.",
    href: "/docs/reference/cli/global/",
    icon: Terminal,
  },
  {
    title: "HTTP API",
    description: "Local API routes, OpenAPI document, and authentication.",
    href: "/docs/reference/api/overview/",
    icon: BookOpen,
  },
];

const workflowItems = [
  {
    title: "Plan work as tickets",
    description: "Capture focused tasks in .pstdio/tickets so every agent starts from a durable source file.",
    href: "/docs/workflows/create-tickets/",
    icon: ClipboardList,
  },
  {
    title: "Launch isolated attempts",
    description: "Send a ticket to an agent workspace without losing the board, status, and review context.",
    href: "/docs/workflows/launch-attempt/",
    icon: Bot,
  },
  {
    title: "Review the result",
    description: "Use the dashboard to inspect sessions, status changes, and the diff before merging work.",
    href: "/docs/workflows/review-diffs/",
    icon: PanelRight,
  },
];

const extensionLinks = [
  {
    title: "Templates",
    description: "Shape prompts, tickets, and documents with reusable Mustache-style templates.",
    href: "/docs/customization/configure-templates/",
    icon: Layers,
  },
  {
    title: "Plugins",
    description: "Add project plugins to wire hooks, actions, and automations into your workflow.",
    href: "/docs/customization/add-plugins/",
    icon: Plug,
  },
  {
    title: "Agents",
    description: "Configure which coding agents Prompt Studio can drive, their defaults, and their models.",
    href: "/docs/customization/configure-agents/",
    icon: Blocks,
  },
  {
    title: "Statuses, tags, and skills",
    description: "Tune status columns, tag dimensions, and the skills Prompt Studio hands to each agent.",
    href: "/docs/customization/project-configuration/",
    icon: Tags,
  },
];

const DocsHomeContent = () => {
  return (
    <Stack gap="12">
      <Stack gap="5">
        <SectionHeading
          label="Guide"
          title="Guide"
          description="Start here when you are setting up Prompt Studio in a repository or wiring it into a local workflow."
        />
        <SimpleGrid columns={{ base: 1, md: 3 }} gap="4">
          {guideLinks.map((item) => (
            <DocsCard key={item.title} {...item} />
          ))}
        </SimpleGrid>
      </Stack>

      <Stack gap="5">
        <SectionHeading
          label="References"
          title="References"
          description="Use these pages when you need exact integration surfaces for scripts, automation, and local API calls."
        />
        <SimpleGrid columns={{ base: 1, md: 3 }} gap="4">
          {referenceLinks.map((item) => (
            <DocsCard key={item.title} {...item} />
          ))}
        </SimpleGrid>
      </Stack>

      <Stack gap="5">
        <SectionHeading
          label="Screenshots"
          title="What you work with day to day"
          description="The dashboard keeps tickets, attempts, session output, and review state visible while the CLI remains available for automation."
        />
        <Stack gap="8">
          <ScreenshotFigure
            src="/images/docs/ticket-board.png"
            alt="Prompt Studio ticket board with status columns"
            aspectRatio="2880 / 1800"
            caption="Ticket board with status columns, drag-and-drop transitions, and display filters."
          />
          <ScreenshotFigure
            src="/images/docs/sessions-panel.png"
            alt="Prompt Studio sessions panel with live agent chat"
            aspectRatio="2880 / 1800"
            caption="Sessions panel with the full tool timeline, approvals, and follow-up input."
          />
        </Stack>
      </Stack>

      <Stack gap="5">
        <SectionHeading
          label="Core workflows"
          title="Plan, delegate, review"
          description="Prompt Studio is built around a narrow loop that keeps each agent attempt understandable."
        />
        <SimpleGrid columns={{ base: 1, md: 3 }} gap="4">
          {workflowItems.map((item) => (
            <DocsCard key={item.title} {...item} />
          ))}
        </SimpleGrid>
      </Stack>

      <Stack gap="5">
        <SectionHeading
          label="Extend your workspace"
          title="Shape Prompt Studio around your repo"
          description="Use project configuration and extension points to make local conventions explicit instead of relying on memory."
        />
        <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap="4">
          {extensionLinks.map((item) => (
            <DocsCard key={item.title} {...item} />
          ))}
        </SimpleGrid>
      </Stack>
    </Stack>
  );
};

export const DocsHomePage = (props: DocsHomePageProps) => {
  const { menuItems, searchItems, next } = props;

  return (
    <DocsPageShell
      title="Start with Prompt Studio"
      description="Prompt Studio helps you turn local project work into tickets, launch coding agents in focused workspaces, and keep review context in one place."
      badge="Local agent orchestration"
      markdown={overviewMarkdown}
      menuItems={menuItems}
      searchItems={searchItems}
      activeLink="/docs/"
      next={next}
    >
      <DocsHomeContent />
    </DocsPageShell>
  );
};
