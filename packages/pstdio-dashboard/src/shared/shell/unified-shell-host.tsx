import { useNavigate, useRouterState } from "@tanstack/react-router";
import { createContext, type ReactNode, useContext, useEffect, useRef } from "react";
import { createDashboardShell, type DashboardShell } from "./dashboard-shell";
import { applyRouteActivation, resolveRouteActivation, TanStackShellAdapter } from "./tanstack-shell-adapter";

const UnifiedShellContext = createContext<DashboardShell | null>(null);

export const useUnifiedShell = () => {
  const shell = useContext(UnifiedShellContext);
  if (!shell) throw new Error("useUnifiedShell must be used inside <UnifiedShellHost>");
  return shell;
};

interface UnifiedShellHostProps {
  children?: ReactNode;
}

/**
 * Mounts the unified dashboard shell once at the dashboard root, wires the
 * TanStack ↔ shell navigation adapter, and exposes the shell via context for
 * routes to consume.
 *
 * Uses `useRef` rather than `useState(createDashboardShell)` because React
 * StrictMode invokes useState initializers twice in development, producing two
 * shell instances. React keeps one; the other becomes orphaned but still
 * registered widgets and listeners — which then race against the kept shell.
 * `useRef` initializes exactly once.
 *
 * The initial mode is activated synchronously during the first render so the
 * first React commit sees the active widget in the layout — matching how the
 * per-route shells open their widgets before `<ShellWorkbench>` mounts. Without
 * this, the workbench commits an empty layout first and never refreshes
 * because it doesn't subscribe to layout changes.
 */
export const UnifiedShellHost = ({ children }: UnifiedShellHostProps) => {
  const shellRef = useRef<DashboardShell | null>(null);
  const initialPathname = useRouterState({ select: (state) => state.location.pathname });
  if (!shellRef.current) {
    shellRef.current = createDashboardShell();
    applyRouteActivation(shellRef.current, resolveRouteActivation({ pathname: initialPathname }));
  }
  const shell = shellRef.current;
  const navigate = useNavigate();

  useEffect(() => {
    shell.setNavigate((path) => {
      navigate({ to: path });
    });
  }, [shell, navigate]);

  return (
    <UnifiedShellContext.Provider value={shell}>
      <TanStackShellAdapter shell={shell} />
      {children}
    </UnifiedShellContext.Provider>
  );
};
