import { createContext, type RefObject } from "react";
import type { createMarkdownSessionDocument } from "./markdown-session-document";
import type { createMarkdownTextDocument } from "./markdown-text-document";

export type MarkdownDocumentBinding =
  | ReturnType<typeof createMarkdownTextDocument>
  | ReturnType<typeof createMarkdownSessionDocument>;
export const MarkdownDocumentContext = createContext<RefObject<MarkdownDocumentBinding | null> | null>(null);
