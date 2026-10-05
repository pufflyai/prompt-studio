import { Text } from "@chakra-ui/react";
import { ListRow } from "@pstdio/ui";
import { BookOpen } from "lucide-react";
import { Fragment, useState } from "react";
import { docsTopicForPath } from "../../content/docs-topics";
import type { LandingPage } from "../../content/landing-pages";
import { useLandingStyles } from "../../hooks/use-landing-styles";
import { docsTree } from "../../services/docs-tree";

interface DocsSidebarProps {
  page: LandingPage;
  pages: LandingPage[];
  onNavigate: (path: string) => void;
}

export const DocsSidebar = (props: DocsSidebarProps) => {
  const { page, pages, onNavigate } = props;
  const styles = useLandingStyles();
  const activeTopic = docsTopicForPath(page.path)?.path;
  const [expanded, setExpanded] = useState(() => new Set(activeTopic ? [activeTopic] : []));
  // The topic being read always opens, also when a link or the pager leads there.
  const [revealedTopic, setRevealedTopic] = useState(activeTopic);
  if (activeTopic !== revealedTopic) {
    setRevealedTopic(activeTopic);
    if (activeTopic) setExpanded((topics) => new Set(topics).add(activeTopic));
  }

  // Opening a topic also opens its first page; selecting an open topic closes it.
  const toggleTopic = (topicPath: string, firstPage: string) => {
    const next = new Set(expanded);
    if (expanded.has(topicPath)) next.delete(topicPath);
    else {
      next.add(topicPath);
      onNavigate(firstPage);
    }
    setExpanded(next);
  };

  // Page rows sit at depth 2 so their labels line up under the topic label, past its chevron.
  return (
    <>
      <ListRow
        icon={<BookOpen />}
        label="Docs home"
        href="/docs/"
        role="link"
        isSelected={page.view === "docs"}
        aria-current={page.view === "docs" ? "page" : undefined}
      />
      {docsTree(pages).map(({ section, topics }) => (
        <Fragment key={section}>
          <Text css={styles.sidebarHeading}>{section}</Text>
          {topics.map(({ topic, pages: topicPages }) => {
            const open = expanded.has(topic.path);
            return (
              <Fragment key={topic.path}>
                <ListRow
                  label={topic.label}
                  role="button"
                  variant="tree"
                  isContainer
                  showExpandToggle
                  isExpanded={open}
                  onToggleExpand={() => toggleTopic(topic.path, topicPages[0].path)}
                />
                {open &&
                  topicPages.map((topicPage) => (
                    <ListRow
                      key={topicPage.path}
                      depth={2}
                      variant="tree"
                      label={topicPage.label}
                      href={topicPage.path}
                      role="link"
                      isSelected={topicPage.path === page.path}
                      aria-current={topicPage.path === page.path ? "page" : undefined}
                    />
                  ))}
              </Fragment>
            );
          })}
        </Fragment>
      ))}
    </>
  );
};
