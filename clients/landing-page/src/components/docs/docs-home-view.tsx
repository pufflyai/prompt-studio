import { Box } from "@chakra-ui/react";
import { Fragment } from "react";
import type { LandingPage } from "../../content/landing-pages";
import { useDocStyles } from "../../hooks/use-landing-styles";
import { docsTree } from "../../services/docs-tree";
import { DocColumn } from "../workbench/doc-column";
import { DocOutline } from "../workbench/doc-outline";

interface DocsHomeViewProps {
  page: LandingPage;
  pages: LandingPage[];
}

/** The Docs home has no markdown of its own. It lists the sidebar tree. */
export const DocsHomeView = (props: DocsHomeViewProps) => {
  const { page, pages } = props;
  const styles = useDocStyles();
  const tree = docsTree(pages);
  const headings = tree.map(({ section }) => ({ depth: 2, slug: section.toLowerCase(), text: section }));

  return (
    <DocColumn pageKey={page.path} aside={<DocOutline headings={headings} />}>
      <h1>Docs</h1>
      <p>{page.description}</p>
      {tree.map(({ section, topics }) => (
        <Fragment key={section}>
          <h2 id={section.toLowerCase()}>{section}</h2>
          <Box css={styles.homeTopics}>
            {topics.map(({ topic, pages: topicPages }) => (
              <div key={topic.path}>
                <h3>{topic.label}</h3>
                <ul>
                  {topicPages.map((topicPage) => (
                    <li key={topicPage.path}>
                      <a href={topicPage.path}>{topicPage.label}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </Box>
        </Fragment>
      ))}
    </DocColumn>
  );
};
