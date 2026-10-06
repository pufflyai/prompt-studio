import type { LandingPage } from "../../content/landing-pages";
import { DocColumn } from "../workbench/doc-column";
import { PostListItem } from "./post-list-item";

interface BlogIndexViewProps {
  page: LandingPage;
  pages: LandingPage[];
}

export const BlogIndexView = (props: BlogIndexViewProps) => {
  const { page, pages } = props;
  const posts = pages.filter((post) => post.view === "post").sort((a, b) => b.published.localeCompare(a.published));

  return (
    <DocColumn pageKey={page.path}>
      <h1>Blog</h1>
      <p>{page.description}</p>
      {posts.map((post, index) => (
        <PostListItem key={post.path} page={post} featured={index === 0} />
      ))}
    </DocColumn>
  );
};
