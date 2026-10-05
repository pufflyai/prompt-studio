import type { LandingPage } from "../../content/landing-pages";
import { DocColumn } from "../workbench/doc-column";
import { PostListItem } from "./post-list-item";

interface BlogIndexViewProps {
  page: LandingPage;
  pages: LandingPage[];
}

export const BlogIndexView = (props: BlogIndexViewProps) => {
  const { page, pages } = props;

  return (
    <DocColumn pageKey={page.path}>
      <h1>Blog</h1>
      <p>{page.description}</p>
      {pages.map((post) => post.view === "post" && <PostListItem key={post.path} page={post} />)}
    </DocColumn>
  );
};
