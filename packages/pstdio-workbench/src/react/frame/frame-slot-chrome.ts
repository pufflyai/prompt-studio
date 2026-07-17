import type { HeaderVariant } from "@pstdio/ui";
import type { WorkbenchFocusArea } from "../../core";

export interface FrameSlotChrome {
  as?: "aside" | "section" | "nav" | "footer";
  headerVariant: HeaderVariant;
  focus?: { area: WorkbenchFocusArea; scope: "content" | "region" };
  growHeaderWhenEmpty?: boolean;
}

const defaultChrome: FrameSlotChrome = { headerVariant: "main" };

const classicChrome: Record<string, FrameSlotChrome> = {
  "main-header": { headerVariant: "main", growHeaderWhenEmpty: true },
  "main-left": { as: "aside", headerVariant: "main" },
  main: { headerVariant: "main", focus: { area: "main", scope: "content" } },
  "main-right": { as: "aside", headerVariant: "main" },
  secondary: {
    as: "section",
    headerVariant: "main",
    focus: { area: "panel", scope: "region" },
  },
};

export const resolveSlotChrome = (slotId: string) => classicChrome[slotId] ?? defaultChrome;
