import type { HeaderVariant } from "@pstdio/ui";
import type { WorkbenchFocusArea } from "../../core";

export interface FrameSlotChrome {
  as?: "aside" | "section" | "nav" | "footer";
  renderer?: "activity" | "nav" | "side" | "status";
  headerVariant: HeaderVariant;
  headerLayout?: "full-bleed";
  focus?: { area: WorkbenchFocusArea; scope: "content" | "region" };
  growHeaderWhenEmpty?: boolean;
}

const defaultChrome: FrameSlotChrome = { headerVariant: "main" };

const classicChrome: Record<string, FrameSlotChrome> = {
  activity: { as: "nav", renderer: "activity", headerVariant: "main" },
  nav: { renderer: "nav", headerVariant: "main" },
  left: {
    as: "aside",
    headerVariant: "main",
    headerLayout: "full-bleed",
    focus: { area: "sideBar", scope: "region" },
  },
  main: { headerVariant: "main", focus: { area: "main", scope: "content" }, growHeaderWhenEmpty: true },
  secondary: {
    as: "section",
    headerVariant: "main",
    focus: { area: "panel", scope: "region" },
  },
  status: { as: "footer", renderer: "status", headerVariant: "main" },
  side: { as: "aside", renderer: "side", headerVariant: "main" },
};

export const resolveSlotChrome = (slotId: string) => classicChrome[slotId] ?? defaultChrome;
