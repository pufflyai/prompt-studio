import { createDashboardShell } from "./dashboard-shell";
import { TanStackShellAdapter } from "./tanstack-shell-adapter";
import { useShell } from "./use-shell";

/**
 * Mounts the unified dashboard shell once at the dashboard root and wires the
 * TanStack ↔ shell navigation adapter. Chunk 1 of PS-281 — no widgets render
 * yet; existing per-route shells continue to own UI.
 */
export const UnifiedShellHost = () => {
  const shell = useShell(createDashboardShell);
  return <TanStackShellAdapter shell={shell} />;
};
