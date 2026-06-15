import type { TestRunnerConfig } from "@storybook/test-runner";

/**
 * Storybook test-runner configuration for the mount-smoke tier.
 *
 * Stories tagged "mount-smoke-skip" are excluded from this tier — typically
 * because they declare a play function whose assertions are not stable
 * yet. New `mount-smoke-skip` entries must reference a tracking ticket so
 * the gap stays visible. See .pstdio/docs/contributing/storybook-play-coverage.md.
 */
const config: TestRunnerConfig = {
  tags: {
    skip: ["mount-smoke-skip"],
  },
};

export default config;
