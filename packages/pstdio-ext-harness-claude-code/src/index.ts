import { defineExtension } from "@pstdio/sdk/extensions";
import { createClaudeCodeHarnessProvider } from "./providers/claude-code";

export const CLAUDE_CODE_HARNESS_EXTENSION_ID = "pstdio.harness.claude-code";
export const CLAUDE_CODE_HARNESS_PACKAGE_NAME = "@pstdio/pstdio-ext-harness-claude-code";
export { createClaudeCodeHarnessProvider };

export default defineExtension({
  id: CLAUDE_CODE_HARNESS_EXTENSION_ID,
  name: "Claude Code Harness",
  version: "0.1.0",
  harnesses: {
    claudeCode: createClaudeCodeHarnessProvider(),
  },
});
