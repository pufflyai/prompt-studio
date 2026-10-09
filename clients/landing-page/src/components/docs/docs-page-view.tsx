import type { LandingDocument, LandingPage } from "../../content/landing-pages";
import { DocColumn, DocHtml } from "../workbench/doc-column";
import { DocOutline } from "../workbench/doc-outline";

interface DocsPageViewProps {
  page: LandingPage;
  document: LandingDocument;
}

export const DocsPageView = (props: DocsPageViewProps) => {
  const { page, document } = props;

  return (
    <DocColumn pageKey={page.path} aside={<DocOutline key={page.path} headings={document.headings} />}>
      <DocHtml html={document.html} />
    </DocColumn>
  );
};
