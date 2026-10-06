import { AlertMessage } from "@pstdio/ui";
import type { LandingDocument, LandingPage } from "../../content/landing-pages";
import { DocColumn, DocHtml } from "../workbench/doc-column";
import { DocOutline } from "../workbench/doc-outline";
import { PostBanner } from "./post-banner";
import { PostMeta } from "./post-meta";

interface PostViewProps {
  page: Extract<LandingPage, { view: "post" }>;
  document: LandingDocument;
}

export const PostView = (props: PostViewProps) => {
  const { page, document } = props;

  return (
    <DocColumn pageKey={page.path} aside={<DocOutline key={page.path} headings={document.headings} />}>
      <PostBanner image={page.image} />
      <header>
        <h1>{page.label}</h1>
        <PostMeta page={page} />
      </header>
      {page.category === "release" && (
        <AlertMessage
          role="note"
          aria-label="Alpha release notice"
          status="info"
          variant="subtle"
          title="Prompt Studio is still in alpha"
        >
          The APIs and core feature set are not fully defined yet. They can change day by day, introducing breaking
          changes until we reach beta.
        </AlertMessage>
      )}
      <DocHtml html={document.html} />
    </DocColumn>
  );
};
