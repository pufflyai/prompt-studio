/**
 * Quarantined UI Playwright specs.
 *
 * These specs exercise the pre-workbench dashboard surfaces (ticket/session/
 * workspace routes, the old project-list ingress, extensions and settings
 * panels) that the workbench-based dashboard does not reconstruct yet. They
 * stay quarantined while the convergence work in `pstdio-workbench` and
 * `pstdio-dashboard` ports each feature back.
 *
 * The list is also consumed by `scripts/verify/verify-quarantine.ts`, which
 * gates CI: a spec may only enter quarantine after it is added to
 * `packages/e2e/quarantine-baseline.json`. Adding to this list without
 * updating the baseline fails the gate.
 *
 * When a ported feature is shipped, remove the spec from this list *and*
 * from the baseline.
 */
export const QUARANTINED_WORKBENCH_MIGRATION_SPECS = [
  "**/command-palette-actions.spec.ts",
  "**/command-palette-keyboard.spec.ts",
  "**/extension-webviews.spec.ts",
  "**/extensions.spec.ts",
  "**/project-settings.spec.ts",
  "**/projects.spec.ts",
  "**/session-chat-and-workspaces.spec.ts",
  "**/sessions.spec.ts",
  "**/stale-reconnect-dashboard.spec.ts",
  "**/ticket-workspace-images.spec.ts",
  "**/tickets-board-scroll.spec.ts",
  "**/tickets-shell.spec.ts",
  "**/tickets.spec.ts",
  "**/tree-list-keyboard.spec.ts",
];
