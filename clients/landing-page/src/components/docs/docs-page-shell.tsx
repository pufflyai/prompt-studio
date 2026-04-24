import { Box, Container, Flex, Stack } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { ContentImageLightbox } from "../content-image-lightbox";
import Footer from "../footer";
import Header from "../header";
import { RootProvider } from "../root-provider";
import { DocsHeader } from "./docs-header";
import { normalizeDocsPath } from "./docs-menu";
import { DocsPagination, type DocsPaginationItem, DocsSidebar, type DocsSidebarItem } from "./docs-navigation";
import { DocsOutline } from "./docs-outline";
import { DocsPageIntro } from "./docs-page-intro";
import type { DocsSearchItem } from "./docs-search";

export interface DocsPageMeta {
  title: string;
  description: string;
  htmlTitle?: string;
  htmlDescription?: string;
  section: string;
  category?: string;
  categoryOrder?: number;
  order: number;
}

interface DocsPageShellProps {
  title: string;
  description?: string;
  badge?: string;
  markdown: string;
  menuItems: DocsSidebarItem[];
  searchItems: DocsSearchItem[];
  activeLink: string;
  previous?: DocsPaginationItem;
  next?: DocsPaginationItem;
  headerActions?: ReactNode;
  children: ReactNode;
}

const DocsPageShellContent = (props: DocsPageShellProps) => {
  const {
    title,
    description,
    badge,
    markdown,
    menuItems,
    searchItems,
    activeLink,
    previous,
    next,
    headerActions,
    children,
  } = props;
  const sidebarItems = getActiveDocsSidebarItems(menuItems, activeLink);

  const handleSelectLink = (link: string) => {
    window.location.href = link;
  };

  const shouldStartOpen = (item: DocsSidebarItem) => {
    return hasActiveLink(item, activeLink);
  };

  return (
    <Flex direction="column" minHeight="100vh">
      <Header activeSection="docs" />
      <Flex as="main" flex="1" direction="column" alignItems="center">
        <Container maxW="8xl" px={["1.5rem", "1.5rem", "3.75rem"]} width="100%">
          <Flex gap="8" pt="0" pb={["2rem", "2rem", "3rem"]} alignItems="flex-start">
            <Box hideBelow="lg" width="16rem" flexShrink={0} position="sticky" top="6">
              <DocsSidebar
                menuItems={sidebarItems}
                activeLink={activeLink}
                onSelectLink={handleSelectLink}
                shouldStartOpen={shouldStartOpen}
              />
            </Box>

            <Box flex="1" minWidth="0">
              <Stack gap="1.5rem" maxW="90ch">
                <DocsHeader
                  menuItems={menuItems}
                  searchItems={searchItems}
                  activeLink={activeLink}
                  markdown={markdown}
                />
                {title ? (
                  <DocsPageIntro
                    badge={badge ?? "Docs"}
                    title={title}
                    description={description}
                    actions={headerActions}
                  />
                ) : null}

                <ContentImageLightbox>{children}</ContentImageLightbox>

                <Box pt="4" borderTopWidth="1px">
                  <DocsPagination previous={previous} next={next} />
                </Box>
              </Stack>
            </Box>

            <Box hideBelow="xl" width="16rem" flexShrink={0} position="sticky" top="6" alignSelf="flex-start">
              <DocsOutline markdown={markdown} />
            </Box>
          </Flex>
        </Container>
      </Flex>
      <Footer
        links={[
          { item: "GitHub", url: "https://github.com/pufflyai/prompt-studio" },
          { item: "Discord", url: "https://discord.gg/3RxwUEk8fW" },
          { item: "Privacy Policy", url: "/privacy-policy/" },
          { item: "Terms", url: "/terms/" },
        ]}
      />
    </Flex>
  );
};

export const DocsPageShell = (props: DocsPageShellProps) => {
  return (
    <RootProvider>
      <DocsPageShellContent {...props} />
    </RootProvider>
  );
};

function hasActiveLink(item: DocsSidebarItem, activeLink: string): boolean {
  if (item.link && normalizeDocsPath(item.link) === normalizeDocsPath(activeLink)) return true;
  return item.items?.some((child) => hasActiveLink(child, activeLink)) ?? false;
}

function getActiveDocsSidebarItems(menuItems: DocsSidebarItem[], activeLink: string) {
  const activeSection = menuItems.find((item) => hasActiveLink(item, activeLink));
  const fallbackSection = menuItems[0];

  return activeSection?.items ?? fallbackSection?.items ?? [];
}
