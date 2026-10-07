// Route relative ticket attachments through Planner's public ticket navigation.
import type { NavigationTarget } from "@pstdio/sdk/extensions";
import { createContext, type ReactNode } from "react";
import type { Plan, PlanRow } from "../contracts";
import { instructionTarget } from "./instruction-target";

export const InstructionNavigation = createContext<((href: string) => (() => void) | undefined) | undefined>(undefined);

export function InstructionLinks({
  row,
  plan,
  onOpen,
  children,
}: {
  row: PlanRow;
  plan: Plan;
  onOpen: (target: NavigationTarget) => void;
  children: ReactNode;
}) {
  const resolve = (href: string) => {
    const target = instructionTarget(
      href,
      row,
      plan.sections.flatMap(({ rows }) => rows),
    );
    if (target) {
      return () => onOpen(target);
    }
  };
  return <InstructionNavigation.Provider value={resolve}>{children}</InstructionNavigation.Provider>;
}
