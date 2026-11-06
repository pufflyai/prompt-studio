import type { CanvasMeta } from "@pstdio/canvas";
import { RequirementBook } from "./requirement-book";

export default {
  title: "Proposals/PS-104 Requirement book",
  fullscreen: true,
} satisfies CanvasMeta;

export const Documentation = () => <RequirementBook />;
