import { docPageToMarkdown } from "./doc-page-markdown";
import { DocumentationReader } from "./documentation-reader";

export type DocBlock =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] }
  | { type: "code"; code: string; language?: string }
  | { type: "quote"; text: string }
  | { type: "image"; src: string; alt: string };

export interface DocPage {
  title: string;
  intro?: string;
  meta?: string;
  blocks: DocBlock[];
}

interface DocViewProps {
  page: DocPage;
}

export const DocView = (props: DocViewProps) => {
  const { page } = props;
  return <DocumentationReader markdown={docPageToMarkdown(page)} />;
};
