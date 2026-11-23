import { createLucideIcon } from "lucide-react";

// Lucide TextPen (ISC): https://github.com/lucide-icons/lucide/blob/main/icons/text-pen.svg
export const TextPen = createLucideIcon("TextPen", [
  ["path", { d: "M12 12H3", key: "middle" }],
  ["path", { d: "M21 5H3", key: "top" }],
  [
    "path",
    {
      d: "M21.377 14.626a1 1 0 10-3.004-3.004l-5.01 5.012a2 2 0 00-.506.854l-.837 2.87a.5.5 0 00.62.62l2.87-.837a2 2 0 00.854-.506z",
      key: "pen",
    },
  ],
  ["path", { d: "M8 19H3", key: "bottom" }],
]);
