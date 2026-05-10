import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import type { ReactNode } from "react";
import { expect } from "storybook/test";
import { type Diff, DiffDrawer } from "./diff-drawer";
import { MAX_RENDERED_DIFF_LINES } from "./diff-view-adapter";

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

const changes: Diff["change"][] = ["modified", "added", "deleted", "renamed"];

const manyDiffs: Diff[] = Array.from({ length: 200 }, (_, i) => ({
  change: changes[i % changes.length],
  oldPath: `src/components/file-${i}.ts`,
  newPath: `src/components/file-${i}.ts`,
  oldContent: `// file ${i} original\nexport const value = ${i};\n`,
  newContent: `// file ${i} updated\nexport const value = ${i + 1};\n`,
  additions: 1,
  deletions: 1,
}));

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

const largeDiffLines = Array.from(
  { length: MAX_RENDERED_DIFF_LINES },
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
