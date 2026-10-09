import type { LandingDocument, LandingPage } from "../../content/landing-pages";
import { BlogIndexView } from "../blog/blog-index-view";
import { PostView } from "../blog/post-view";
import { DocsHomeView } from "../docs/docs-home-view";
import { DocsPageView } from "../docs/docs-page-view";
import { DocColumn, DocHtml } from "./doc-column";

interface ReadingContentProps {
  page: LandingPage;
  pages: LandingPage[];
  document: LandingDocument | undefined;
}

/** Pages that read as one column: legal pages, docs, and the blog. */
export const ReadingContent = (props: ReadingContentProps) => {
  const { page, pages, document = { html: "", headings: [] } } = props;
  if (page.view === "docs") return <DocsHomeView page={page} pages={pages} />;
  if (page.view === "doc") return <DocsPageView page={page} document={document} />;
  if (page.view === "blog") return <BlogIndexView page={page} pages={pages} />;
  if (page.view === "post") return <PostView page={page} document={document} />;
  return (
    <DocColumn pageKey={page.path}>
      <DocHtml html={document.html} />
    </DocColumn>
  );
};
