const browserFamilies = {
  sessions: ["session-menu-parity.spec.ts", "session-chat-state.spec.ts", "session-panel-restore.spec.ts"],
  editors: ["ticket-scroll-reset.spec.ts", "ticket-editor-save-lifecycle.spec.ts"],
  extensions: [
    "marketplace-extension-lifecycle.spec.ts",
    "webview-resource-rebinding.spec.ts",
    "extension-webview-bridge.spec.ts",
  ],
};

export const allBrowserChecks = Object.values(browserFamilies).flat();

const isSharedInput = (file: string) =>
  /^(scripts\/|\.github\/|packages\/(sdk|ui|pstdio-workbench|pstdio-api-contracts|pstdio-db|pstdio-storage|pstdio-sync|workbench-fixture)\/)/.test(
    file,
  ) ||
  /^(bun\.lock|bunfig\.toml|package\.json|nx\.json|tsconfig\.base\.json)$/.test(file) ||
  file.startsWith("packages/e2e/src/ui/helpers/") ||
  file.startsWith("packages/e2e/src/helpers/");

export const selectBrowserChecks = (changedFiles: string[], affectsBrowser = false) => {
  const code = changedFiles.filter((file) => !file.endsWith(".md"));
  if (code.some(isSharedInput)) return allBrowserChecks;
  const rules = [
    { pattern: /session|harness|composer|chat|approval|question/, specs: browserFamilies.sessions },
    { pattern: /ticket|editor|markdown|pstdio-planner|pstdio-notes/, specs: browserFamilies.editors },
    { pattern: /extension|webview|bridge|marketplace/, specs: browserFamilies.extensions },
  ];
  const selected = new Set(
    code
      .filter((file) => /^(packages\/|extensions\/)/.test(file))
      .flatMap((file) => rules.filter((rule) => rule.pattern.test(file)).flatMap((rule) => rule.specs)),
  );
  // A new shared browser input must not silently lose coverage because its name is unknown.
  if (!selected.size && affectsBrowser) return allBrowserChecks;
  return [...selected].sort();
};
