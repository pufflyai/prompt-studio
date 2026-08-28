import type { DocPage } from "../doc-view";
import { helloWorldPage } from "./blog/hello-world";
import { theWorkbenchPage } from "./blog/the-workbench";

export interface BlogPost {
  id: string;
  title: string;
  date: string;
  page: DocPage;
  /** Keep the post reachable by direct URL while hiding it from the post list. */
  hidden?: boolean;
}

export const BLOG_POSTS: BlogPost[] = [
  { id: "the-workbench", title: "Meet the workbench", date: "2026-07-21", page: theWorkbenchPage, hidden: true },
  { id: "hello-world", title: "Welcome to Prompt Studio!", date: "2026-04-24", page: helloWorldPage },
];

export const VISIBLE_BLOG_POSTS = BLOG_POSTS.filter((post) => !post.hidden);
