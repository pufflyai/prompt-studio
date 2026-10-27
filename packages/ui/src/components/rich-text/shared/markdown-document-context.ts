import { createContext, type RefObject } from "react";
import type { createMarkdownTextDocument } from "./markdown-text-document";

export type MarkdownDocumentBinding = ReturnType<typeof createMarkdownTextDocument>;
export const MarkdownDocumentContext = createContext<RefObject<MarkdownDocumentBinding | null> | null>(null);
