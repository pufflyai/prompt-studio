import { deriveMarkdownTitle } from "@pstdio/sdk/extensions";

// Point reads and indexed Board/Timeline titles share the canonical Markdown rules.
export const deriveTitle = (content: string) => deriveMarkdownTitle(content, "Untitled");
