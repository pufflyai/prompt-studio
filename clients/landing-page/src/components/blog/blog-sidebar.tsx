import { ListRow } from "@pstdio/ui";
import { Newspaper } from "lucide-react";
import type { LandingPage } from "../../content/landing-pages";

interface BlogSidebarProps {
  page: LandingPage;
  pages: LandingPage[];
}

export const BlogSidebar = (props: BlogSidebarProps) => {
  const { page, pages } = props;
  const rows = [
    { path: "/blog/", label: "All posts", icon: <Newspaper /> },
    ...pages
      .filter((item) => item.view === "post")
      .map((post) => ({ path: post.path, label: post.label, icon: undefined })),
  ];

  return rows.map((row) => (
    <ListRow
      key={row.path}
      icon={row.icon}
      label={row.label}
      href={row.path}
      role="link"
      isSelected={row.path === page.path}
      aria-current={row.path === page.path ? "page" : undefined}
    />
  ));
};
