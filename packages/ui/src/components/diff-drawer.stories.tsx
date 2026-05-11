import { Box, Button, Flex } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { type ReactNode, useState } from "react";
import { expect } from "storybook/test";
import { type Diff, DiffDrawer } from "./diff-drawer";
import { LARGE_DIFF_LINE_THRESHOLD } from "./diff-size";
import { ScrollArea } from "./scroll-area";

type StoryFn = () => ReactNode;

const sampleDiffs: Diff[] = [
  {
    change: "modified",
    oldPath: "src/index.ts",
    newPath: "src/index.ts",
    oldContent: `import { foo } from "./foo";\n\nconsole.log(foo);\n`,
    newContent: `import { foo, bar } from "./foo";\n\nconsole.log(foo);\nconsole.log(bar);\n`,
    additions: 2,
    deletions: 0,
  },
  {
    change: "added",
    newPath: "src/new-file.tsx",
    oldContent: "",
    newContent: `export const NewFile = () => {\n  return <div>New File</div>;\n};\n`,
    additions: 3,
    deletions: 0,
  },
  {
    change: "deleted",
    oldPath: "src/old-file.ts",
    oldContent: `export const old = true;\n`,
    newContent: "",
    additions: 0,
    deletions: 1,
  },
  {
    change: "renamed",
    oldPath: "src/utils.ts",
    newPath: "src/helpers.ts",
    oldContent: `export const util = () => {};\n`,
    newContent: `export const helper = () => {};\n`,
    additions: 1,
    deletions: 1,
  },
  {
    change: "modified",
    oldPath:
      "packages/very-long-directory-name-that-should-be-truncated-because-it-is-so-long/and-another-subdirectory/even-more-nesting/the-final-file-name-which-is-also-quite-long.ts",
    newPath:
      "packages/very-long-directory-name-that-should-be-truncated-because-it-is-so-long/and-another-subdirectory/even-more-nesting/the-final-file-name-which-is-also-quite-long.ts",
    oldContent: "// long path test\n",
    newContent: "// long path test - updated\n",
    additions: 1,
    deletions: 0,
  },
];

const meta: Meta<typeof DiffDrawer> = {
  title: "Components/DiffDrawer",
  component: DiffDrawer,
  parameters: {
    layout: "fullscreen",
  },
  decorators: [
    (Story: StoryFn) => (
      <Box height="100vh" width="100vw" border="1px solid" borderColor="border.muted" overflow="hidden">
        <Story />
      </Box>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof DiffDrawer>;

const getScrollableElement = (root: HTMLElement) => {
  return Array.from(root.querySelectorAll("div")).find((element) => {
    const style = window.getComputedStyle(element);
    return element.scrollHeight > element.clientHeight && /(auto|scroll)/.test(style.overflowY);
  });
};

export const Default: Story = {
  render: (args) => <DiffDrawer {...args} />,
  args: {
    diffs: sampleDiffs,
  },
};

export const SingleFile: Story = {
  render: (args) => <DiffDrawer {...args} />,
  args: {
    diffs: [sampleDiffs[0]],
  },
};

const userListOldContent = `import { useState } from "react";
import { Button } from "@chakra-ui/react";

interface User {
  id: string;
  name: string;
  email: string;
}

const formatName = (user: User) => {
  return \`\${user.name} <\${user.email}>\`;
};

const greetUser = (user: User) => {
  return \`Hello, \${user.name}!\`;
};

export const UserList = ({ users }: { users: User[] }) => {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div>
      {users.map((user) => (
        <Button key={user.id} onClick={() => setSelected(user.id)}>
          {formatName(user)}
        </Button>
      ))}
    </div>
  );
};
`;

const userListNewContent = `import { useEffect, useState } from "react";
import { Button, Stack } from "@chakra-ui/react";

interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user";
}

const formatName = (user: User) => {
  return \`\${user.name} <\${user.email}>\`;
};

const greetUser = (user: User) => {
  return \`Hello, \${user.name}!\`;
};

export const UserList = ({ users }: { users: User[] }) => {
  const [selected, setSelected] = useState<string | null>(null);
  const admins = users.filter((user) => user.role === "admin");

  useEffect(() => {
    if (!selected && admins[0]) setSelected(admins[0].id);
  }, [admins, selected]);

  return (
    <Stack gap="2">
      {users.map((user) => (
        <Button key={user.id} onClick={() => setSelected(user.id)}>
          {formatName(user)}
        </Button>
      ))}
    </Stack>
  );
};
`;

const configOldContent = `export const defaultConfig = {
  appName: "Prompt Studio",
  version: "1.0.0",
  features: {
    chat: true,
    workspaces: true,
    snippets: false,
  },
  limits: {
    maxTokens: 4096,
    maxAttachments: 5,
  },
  theme: {
    mode: "light",
    accent: "blue",
  },
};
`;

const configNewContent = `export const defaultConfig = {
  appName: "Prompt Studio",
  version: "1.1.0",
  features: {
    chat: true,
    workspaces: true,
    snippets: true,
    diffViewer: true,
  },
  limits: {
    maxTokens: 8192,
    maxAttachments: 10,
  },
  theme: {
    mode: "dark",
    accent: "violet",
  },
};
`;

export const ScatteredChanges: Story = {
  render: (args) => <DiffDrawer {...args} />,
  args: {
    diffs: [
      {
        change: "modified",
        oldPath: "src/features/users/UserList.tsx",
        newPath: "src/features/users/UserList.tsx",
        oldContent: userListOldContent,
        newContent: userListNewContent,
        additions: 7,
        deletions: 3,
      },
    ],
  },
};

export const MultipleFilesWithContext: Story = {
  render: (args) => <DiffDrawer {...args} />,
  args: {
    diffs: [
      {
        change: "modified",
        oldPath: "src/features/users/UserList.tsx",
        newPath: "src/features/users/UserList.tsx",
        oldContent: userListOldContent,
        newContent: userListNewContent,
        additions: 7,
        deletions: 3,
      },
      {
        change: "modified",
        oldPath: "src/config/defaults.ts",
        newPath: "src/config/defaults.ts",
        oldContent: configOldContent,
        newContent: configNewContent,
        additions: 5,
        deletions: 4,
      },
    ],
  },
};

const changes: Diff["change"][] = ["modified", "added", "deleted", "renamed"];

const diffSizes = [2, 8, 24, 60, 140] as const;

const buildVariableSizeContent = (index: number, lineCount: number, suffix: string) => {
  return Array.from({ length: lineCount }, (_, lineIndex) => `// file ${index} ${suffix} line ${lineIndex + 1}`).join(
    "\n",
  );
};

const manyDiffs: Diff[] = Array.from({ length: 200 }, (_, i) => {
  const lineCount = diffSizes[i % diffSizes.length];

  return {
    change: changes[i % changes.length],
    oldPath: `src/components/file-${i}.ts`,
    newPath: `src/components/file-${i}.ts`,
    oldContent: buildVariableSizeContent(i, lineCount, "original"),
    newContent: buildVariableSizeContent(i, lineCount, "updated"),
    additions: lineCount,
    deletions: lineCount,
  };
});

export const ManyFiles: Story = {
  render: (args) => <DiffDrawer {...args} />,
  args: {
    diffs: manyDiffs,
  },
  play: async ({ canvasElement }) => {
    const card = canvasElement.querySelector('[data-testid="diff-card"]');
    const header = canvasElement.querySelector('[data-testid="diff-card-header"]');
    const scrollableElement = getScrollableElement(canvasElement);

    expect(card).toBeInstanceOf(HTMLElement);
    expect(header).toBeInstanceOf(HTMLElement);
    expect(scrollableElement).toBeInstanceOf(HTMLElement);

    if (
      !(card instanceof HTMLElement) ||
      !(header instanceof HTMLElement) ||
      !(scrollableElement instanceof HTMLElement)
    ) {
      return;
    }

    const cardRadius = window.getComputedStyle(card).borderTopLeftRadius;
    const headerRadius = window.getComputedStyle(header).borderTopLeftRadius;

    scrollableElement.scrollTop = 420;
    scrollableElement.dispatchEvent(new Event("scroll", { bubbles: true }));
    for (let i = 0; i < 10; i += 1) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }

    const scrollableRect = scrollableElement.getBoundingClientRect();
    const visibleHeaders = Array.from(canvasElement.querySelectorAll('[data-testid="diff-card-header"]')).filter(
      (element): element is HTMLElement => {
        const rect = element.getBoundingClientRect();
        return element instanceof HTMLElement && rect.bottom > scrollableRect.top && rect.top < scrollableRect.bottom;
      },
    );
    const pinnedHeaders = visibleHeaders.filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.top >= scrollableRect.top && rect.top - scrollableRect.top < 12;
    });

    expect(Number.parseFloat(cardRadius)).toBeGreaterThan(0);
    expect(Number.parseFloat(headerRadius)).toBeGreaterThan(0);
    expect(canvasElement.querySelector('[data-testid="diff-drawer-sticky-header"]')).toBeNull();
    expect(pinnedHeaders).toHaveLength(1);
    expect(pinnedHeaders[0]?.textContent).toContain("src/components/file-");

    for (const visibleHeader of visibleHeaders) {
      const parentCard = visibleHeader.closest('[data-testid="diff-card"]');
      expect(parentCard).toBeInstanceOf(HTMLElement);
      if (!(parentCard instanceof HTMLElement)) continue;

      const headerRect = visibleHeader.getBoundingClientRect();
      const cardRect = parentCard.getBoundingClientRect();
      expect(headerRect.top).toBeGreaterThanOrEqual(cardRect.top - 1);
      expect(headerRect.bottom).toBeLessThanOrEqual(cardRect.bottom + 1);
    }
  },
};

interface DiffDrawerWithOutlineProps {
  diffs: Diff[];
}

const DiffDrawerWithOutline = ({ diffs }: DiffDrawerWithOutlineProps) => {
  const [selectedDiffPath, setSelectedDiffPath] = useState<string | null>(null);
  const outlinePaths = diffs.map((diff) => diff.newPath ?? diff.oldPath ?? "unknown");

  return (
    <Flex h="full" minH="0">
      <Box width="280px" borderRight="1px solid" borderColor="border.muted" minH="0">
        <ScrollArea h="full" contentProps={{ p: "xs", spaceY: "2xs" }}>
          {outlinePaths.map((path) => (
            <Button
              key={path}
              size="xs"
              variant={selectedDiffPath === path ? "solid" : "ghost"}
              justifyContent="flex-start"
              width="100%"
              onClick={() => setSelectedDiffPath(path)}
            >
              <Box as="span" truncate>
                {path}
              </Box>
            </Button>
          ))}
        </ScrollArea>
      </Box>
      <Box flex="1" minW="0" minH="0">
        <DiffDrawer diffs={diffs} selectedDiffPath={selectedDiffPath} />
      </Box>
    </Flex>
  );
};

export const WithOutline: Story = {
  render: () => <DiffDrawerWithOutline diffs={manyDiffs} />,
};

const largeDiffLines = Array.from(
  { length: LARGE_DIFF_LINE_THRESHOLD + 1 },
  (_, i) => `export const value${i + 1} = ${i + 1};`,
);

export const LargeDiffPlaceholder: Story = {
  render: (args) => <DiffDrawer {...args} />,
  args: {
    diffs: [
      {
        change: "added",
        newPath: "src/generated/large-fixture.ts",
        oldContent: "",
        newContent: largeDiffLines.join("\n"),
        additions: largeDiffLines.length,
        deletions: 0,
      },
    ],
  },
};

export const NotLoaded: Story = {
  render: (args) => <DiffDrawer {...args} />,
  args: {
    diffs: [
      {
        change: "modified",
        oldPath: "src/lazy-file.ts",
        newPath: "src/lazy-file.ts",
        additions: 1,
        deletions: 1,
      },
    ],
  },
};
