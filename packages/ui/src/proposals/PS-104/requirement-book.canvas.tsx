import type { CanvasMeta } from "@pstdio/canvas";
import { RequirementBook } from "./requirement-book";

export default {
  title: "Proposals/PS-104 Requirement book",
  fullscreen: true,
  description:
    "Interactive prototype with synthetic data. Review suggestions, map evidence, reconcile changed targets, and compare simulated repository revisions. No real requirements, branches, or pull requests are changed.",
} satisfies CanvasMeta;

export const Documentation = () => <RequirementBook />;
