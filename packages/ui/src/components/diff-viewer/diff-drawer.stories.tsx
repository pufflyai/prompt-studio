import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import type { ReactNode } from "react";
import { type Diff, DiffDrawer } from "./diff-drawer";
import { LARGE_DIFF_LINE_THRESHOLD } from "./diff-size";

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
  title: "Components/Diff/DiffPanel",
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

// Mixes large, medium and tiny diffs so the virtualizer's height estimate can be eyeballed:
// scroll fast top-to-bottom and back — cards should not jump, overlap, or leave gaps.
const manyScrollingDiffs: Diff[] = Array.from({ length: 30 }, (_, index) => {
  const variant = index % 3;
  if (variant === 0) {
    return {
      change: "modified",
      oldPath: `src/features/users/UserList${index}.tsx`,
      newPath: `src/features/users/UserList${index}.tsx`,
      oldContent: userListOldContent,
      newContent: userListNewContent,
      additions: 7,
      deletions: 3,
    };
  }
  if (variant === 1) {
    return {
      change: "modified",
      oldPath: `src/config/defaults${index}.ts`,
      newPath: `src/config/defaults${index}.ts`,
      oldContent: configOldContent,
      newContent: configNewContent,
      additions: 5,
      deletions: 4,
    };
  }
  return {
    change: "added",
    newPath: `src/generated/snippet${index}.ts`,
    oldContent: "",
    newContent: `export const value${index} = ${index};\n`,
    additions: 1,
    deletions: 0,
  };
});

export const ManyFilesScrolling: Story = {
  render: (args) => <DiffDrawer {...args} />,
  args: {
    diffs: manyScrollingDiffs,
  },
};

export const SplitMode: Story = {
  render: (args) => <DiffDrawer {...args} />,
  args: {
    diffViewMode: "split",
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
