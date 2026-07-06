import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import type { Diff } from "./diff-card";
import { DiffViewer } from "./diff-viewer";

// A large, mixed-size changeset for exercising selection scrolling. The initially-expanded diffs at
// the top are tall and their measured heights drift from any per-diff estimate, so clicking a file
// further down the tree is the scenario that used to overshoot and snap back. Use it to check that
// mid-list navigation lands on the target (Split mode makes cards tallest) and that browsing the tree
// keeps only one navigated diff expanded at a time rather than piling up an ever-taller wall.
const buildDiff = (index: number, lineCount: number): Diff => {
  const path = `packages/app/src/feature-${index % 8}/module-${index}.ts`;
  const body = (suffix: string) =>
    Array.from({ length: lineCount }, (_, line) => `export const value_${index}_${line} = "${suffix}-${line}";`).join(
      "\n",
    );
  return {
    change: "modified",
    oldPath: path,
    newPath: path,
    oldContent: body("original"),
    newContent: body("updated"),
    additions: Math.ceil(lineCount / 3),
    deletions: Math.ceil(lineCount / 3),
  };
};

// Front-load tall diffs, then a long tail of small ones so mid-list targets sit far below them.
const scrollDiffs: Diff[] = [
  ...Array.from({ length: 12 }, (_, index) => buildDiff(index, 60 + (index % 4) * 12)),
  ...Array.from({ length: 60 }, (_, index) => buildDiff(index + 12, 4 + (index % 5))),
];
const changedFilePaths = scrollDiffs.map((diff) => diff.newPath ?? diff.oldPath ?? "unknown");

const meta: Meta<typeof DiffViewer> = {
  title: "Patterns/Diff/Diff Viewer Scroll",
  component: DiffViewer,
  parameters: { layout: "fullscreen" },
  render: () => (
    <Box h="100vh" w="100vw" minH="0" display="flex" overflow="hidden">
      <Box flex="1" minH="0" minW="0" display="flex">
        <DiffViewer diffs={scrollDiffs} changedFilePaths={changedFilePaths} defaultSelectedPath={changedFilePaths[0]} />
      </Box>
    </Box>
  ),
};

export default meta;
type Story = StoryObj<typeof DiffViewer>;

/** Selecting files up and down the tree should scroll to each without overshooting and snapping back. */
export const MidListNavigation: Story = {};
