import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { type OnboardingInfo, OnboardingPreview } from "./preview";
import claudeLogo from "./preview-assets/claude-code.svg?raw";
import codexLogo from "./preview-assets/codex.svg?raw";
import opencodeLogo from "./preview-assets/open-code.svg?raw";
import piLogo from "./preview-assets/pi.svg?raw";

const harnessIcons = Object.fromEntries(
  [
    ["codex", codexLogo],
    ["claude-code", claudeLogo],
    ["open-code", opencodeLogo],
    ["pi", piLogo],
  ].map(([id, svg]) => [id, `data:image/svg+xml;base64,${btoa(svg!)}`]),
);
const info: OnboardingInfo = {
  platform: "darwin",
  detectedHarnesses: ["codex", "open-code"],
  installedExtensions: ["pstdio.home", "pstdio.onboarding", "pstdio.base-themes", "pstdio.skills"],
  state: { completed: false, hidden: false, harnesses: null, workAreas: null },
};

const meta = {
  title: "Extensions/Onboarding/Setup",
  description: "Open only after the project confirms an enabled setup contribution; otherwise show no setup overlay.",
  component: OnboardingPreview,
  args: { info, harnessIcons },
  fullscreen: true,
} satisfies CanvasMeta<typeof OnboardingPreview>;
export default meta;
type Story = CanvasFrame<typeof meta>;
export const Harnesses: Story = { id: "onboarding-setup--harnesses" };
export const PendingSave: Story = {
  id: "onboarding-setup--pending-save",
  description: "Continue or Finish freezes choices and Back until the submitted selection is accepted.",
  args: { pending: true },
};
export const LoadFailure: Story = {
  id: "onboarding-setup--load-failure",
  description:
    "Setup load failures offer Retry for the created project or Skip setup to use the workspace, even during a pending Retry.",
  args: { loadError: true },
};
export const NoHarness: Story = {
  id: "onboarding-setup--no-harness",
  args: { info: { ...info, state: { ...info.state, harnesses: [] } } },
};
export const InstalledHarness: Story = {
  id: "onboarding-setup--installed-harness",
  args: {
    info: {
      ...info,
      detectedHarnesses: [],
      installedExtensions: [...info.installedExtensions, "pstdio.harness-claude-code"],
    },
  },
};
export const InstalledWork: Story = {
  id: "onboarding-setup--installed-work",
  args: {
    info: {
      ...info,
      installedExtensions: [...info.installedExtensions, "pstdio.planner", "pstdio.reports", "pstdio.artifacts"],
    },
  },
};

export const CompactInstalledWork: Story = {
  ...InstalledWork,
  id: "onboarding-setup--compact-installed-work",
  description: "Continue to see compact installed tool rows in the narrower onboarding form.",
};

export const CompactExtensionsToInstall: Story = {
  id: "onboarding-setup--compact-extensions-to-install",
  description:
    "Continue to see Home, Onboarding, Themes and Skills already installed, with Workspaces selected for Coding.",
};

export const Planning: Story = {
  description: "Continue to see Project planning selected, without Workspaces in the install list.",
  args: { info: { ...info, state: { ...info.state, workAreas: ["planning"] } } },
};

export const Opening: Story = {
  id: "onboarding-setup--opening",
  description: "An eligible setup extension loads its own choices. Project creation and eligibility show no setup UI.",
  args: { loading: true },
};
