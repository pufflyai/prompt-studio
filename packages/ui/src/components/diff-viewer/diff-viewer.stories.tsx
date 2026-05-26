import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { Profiler, type ReactNode, useEffect, useRef, useState } from "react";
import {
  formatPerformanceMs,
  installPerformanceFrameRateSampler,
  type PerformanceFrameRateSnapshot,
  PerformancePanel,
  readPerformanceFrameRateSnapshot,
} from "../performance-panel";
import type { Diff } from "./diff-card";
import { DiffViewer } from "./diff-viewer";

type StoryFn = () => ReactNode;

const sampleDiffs: Diff[] = [
  {
    change: "modified",
    oldPath: "packages/ui/src/components/button.tsx",
    newPath: "packages/ui/src/components/button.tsx",
    oldContent: `export const Button = () => null;\n`,
    newContent: `export const Button = () => <button />;\n`,
    additions: 1,
    deletions: 1,
  },
  {
    change: "added",
    newPath: "packages/ui/src/components/diff-viewer.tsx",
    oldContent: "",
    newContent: `export const DiffViewer = () => null;\n`,
    additions: 1,
    deletions: 0,
  },
  {
    change: "deleted",
    oldPath: "packages/ui/src/components/legacy-diff-panel.tsx",
    oldContent: `export const LegacyDiffPanel = () => null;\n`,
    newContent: "",
    additions: 0,
    deletions: 1,
  },
  {
    change: "renamed",
    oldPath: "packages/ui/src/components/outline.tsx",
    newPath: "packages/ui/src/components/file-tree.tsx",
    oldContent: `export const Outline = () => null;\n`,
    newContent: `export const FileTree = () => null;\n`,
    additions: 1,
    deletions: 1,
  },
];

const binaryDiffs: Diff[] = [
  {
    change: "modified",
    oldPath: "public/assets/logo.png",
    newPath: "public/assets/logo.png",
    oldContent: "",
    newContent: "",
    additions: 0,
    deletions: 0,
  },
  {
    change: "added",
    newPath: "public/assets/hero.jpg",
    oldContent: "",
    newContent: "",
    additions: 0,
    deletions: 0,
  },
  {
    change: "deleted",
    oldPath: "public/fonts/inter.woff2",
    oldContent: "",
    newContent: "",
    additions: 0,
    deletions: 0,
  },
  {
    change: "modified",
    oldPath: "docs/spec.pdf",
    newPath: "docs/spec.pdf",
    oldContent: "",
    newContent: "",
    additions: 0,
    deletions: 0,
  },
];

const changes: Diff["change"][] = ["modified", "added", "deleted", "renamed"];
const diffSizes = [2, 8, 24, 60, 140, 1200] as const;

const buildVariableSizeContent = (index: number, lineCount: number, suffix: string) => {
  return Array.from({ length: lineCount }, (_, lineIndex) => `// file ${index} ${suffix} line ${lineIndex + 1}`).join(
    "\n",
  );
};

const stressDiffs: Diff[] = Array.from({ length: 200 }, (_, index) => {
  const lineCount = diffSizes[index % diffSizes.length];
  const change = changes[index % changes.length];
  const oldPath = `packages/app/src/features/feature-${index % 12}/file-${index}.ts`;
  const newPath =
    change === "renamed" ? `packages/app/src/features/feature-${index % 12}/renamed-${index}.ts` : oldPath;

  return {
    change,
    oldPath,
    newPath,
    oldContent: change === "added" ? "" : buildVariableSizeContent(index, lineCount, "original"),
    newContent: change === "deleted" ? "" : buildVariableSizeContent(index, lineCount, "updated"),
    additions: change === "deleted" ? 0 : lineCount,
    deletions: change === "added" ? 0 : lineCount,
  };
});

interface PerfSample {
  phase: "mount" | "update" | "nested-update";
  actualDuration: number;
  commitTime: number;
}

const DiffViewerPerformancePanel = (props: {
  diffCount: number;
  samples: PerfSample[];
  mountedAtMs: number | null;
  frameRate: PerformanceFrameRateSnapshot;
}) => {
  const { diffCount, samples, mountedAtMs, frameRate } = props;
  const mountSample = samples.find((sample) => sample.phase === "mount") ?? null;
  const updates = samples.filter((sample) => sample.phase !== "mount");

  return (
    <PerformancePanel
      title="Diff viewer performance"
      subtitle="Stress test render metrics"
      badgeLabel={`${diffCount} diffs`}
      metrics={[
        { label: "Ready after paint", value: formatPerformanceMs(mountedAtMs) },
        { label: "Mount render", value: formatPerformanceMs(mountSample?.actualDuration ?? null) },
        { label: "Render updates", value: updates.length.toString() },
      ]}
      framesPerSecond={frameRate.framesPerSecond}
      averageFramesPerSecond={frameRate.averageFramesPerSecond}
      frameRateSamples={frameRate.frameRateSamples}
      rootProps={{
        position: "absolute",
        top: "sm",
        right: "sm",
        zIndex: "overlay",
      }}
      testId="diff-viewer-perf-panel"
    />
  );
};

const DiffViewerStressStory = () => {
  const startedAtRef = useRef(performance.now());
  const [mountedAtMs, setMountedAtMs] = useState<number | null>(null);
  const [samples, setSamples] = useState<PerfSample[]>([]);
  const [frameRate, setFrameRate] = useState<PerformanceFrameRateSnapshot>(() => readPerformanceFrameRateSnapshot());

  useEffect(() => {
    installPerformanceFrameRateSampler();
    const frame = requestAnimationFrame(() => setMountedAtMs(performance.now() - startedAtRef.current));
    const interval = window.setInterval(() => setFrameRate(readPerformanceFrameRateSnapshot()), 250);
    return () => {
      cancelAnimationFrame(frame);
      window.clearInterval(interval);
    };
  }, []);

  return (
    <Box h="full" w="full" minH="0" position="relative" display="flex">
      <DiffViewerPerformancePanel
        diffCount={stressDiffs.length}
        samples={samples}
        mountedAtMs={mountedAtMs}
        frameRate={frameRate}
      />
      <Box flex="1" minH="0" minW="0" display="flex">
        <Profiler
          id="diff-viewer-stress"
          onRender={(_id, phase, actualDuration, _baseDuration, _startTime, commitTime) => {
            setSamples((current) => [...current.slice(-9), { phase, actualDuration, commitTime }]);
          }}
        >
          <DiffViewer diffs={stressDiffs} />
        </Profiler>
      </Box>
    </Box>
  );
};

const meta: Meta<typeof DiffViewer> = {
  title: "Components/Diff/DiffViewer",
  component: DiffViewer,
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
  args: {
    diffs: sampleDiffs,
  },
};

export default meta;

type Story = StoryObj<typeof DiffViewer>;

export const Default: Story = {};

export const Empty: Story = {
  args: {
    diffs: [],
  },
};

export const BinaryAndImage: Story = {
  args: {
    diffs: binaryDiffs,
  },
};

export const StressTest: Story = {
  render: () => <DiffViewerStressStory />,
};
