import { Box } from "@chakra-ui/react";
import { RichMessage } from "@pstdio/ui/rich-text";
import type { ReactNode } from "react";
import type { DocPage } from "../../content/legal";
import { docPageToMarkdown } from "../../services/doc-page-markdown";
import { PageScroll } from "../workbench/page-scroll";

interface DocViewProps {
  page: DocPage;
  footer: ReactNode;
}

export const DocView = (props: DocViewProps) => {
  const { page, footer } = props;
  return (
    <PageScroll>
      <Box width="full" maxWidth="4xl" mx="auto" px={{ base: "lg", md: "xl" }} py="xl">
        <RichMessage defaultState={docPageToMarkdown(page)} fullWidth />
        {footer}
      </Box>
    </PageScroll>
  );
};
