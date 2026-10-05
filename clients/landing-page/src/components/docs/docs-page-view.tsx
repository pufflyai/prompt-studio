import { docsTopicForPath } from "../../content/docs-topics";
import type { LandingDocument, LandingPage } from "../../content/landing-pages";
import { docsReadingOrder } from "../../services/landing-route";
import { DocColumn, DocHtml } from "../workbench/doc-column";
import { DocOutline } from "../workbench/doc-outline";
import { type PageLink, PageNavigation } from "../workbench/page-navigation";

// A link into another topic names the topic too, so "Overview" says whose overview it is.
const pageLink = (from: LandingPage, to: LandingPage | undefined): PageLink | undefined => {
  if (!to) return undefined;
  const topic = docsTopicForPath(to.path);
  const sameTopic = !topic || topic === docsTopicForPath(from.path);
  return { href: to.path, label: sameTopic ? to.label : `${topic.label}: ${to.label}` };
};

interface DocsPageViewProps {
  page: LandingPage;
  pages: LandingPage[];
  document: LandingDocument;
}

export const DocsPageView = (props: DocsPageViewProps) => {
  const { page, pages, document } = props;
  const order = docsReadingOrder(pages);
  const index = order.findIndex((item) => item.path === page.path);

  return (
    <DocColumn pageKey={page.path} aside={<DocOutline key={page.path} headings={document.headings} />}>
      <DocHtml html={document.html} />
      <PageNavigation size="sm" previous={pageLink(page, order[index - 1])} next={pageLink(page, order[index + 1])} />
    </DocColumn>
  );
};
