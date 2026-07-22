import { Box, Container, Flex, Stack, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { ContentImageLightbox } from "../content-image-lightbox";
import Footer from "../footer";
import Header from "../header";
import { RootProvider } from "../root-provider";
import { DocsPagination, type DocsPaginationItem, DocsSidenav, type DocsSidenavItem } from "./docs-navigation";
import { DocsOutline } from "./docs-outline";

export interface DocsPageMeta {
  title: string;
  description: string;
  section: string;
  order: number;
}

interface DocsPageShellProps {
  title: string;
  description?: string;
  markdown: string;
  menuItems: DocsSidenavItem[];
  activeLink: string;
  previous?: DocsPaginationItem;
  next?: DocsPaginationItem;
  children: ReactNode;
}

const DocsPageShellContent = (props: DocsPageShellProps) => {
  const { title, description, markdown, menuItems, activeLink, previous, next, children } = props;

  const handleSelectLink = (link: string) => {
    window.location.href = link;
  };

  const shouldStartOpen = (item: DocsSidenavItem) => {
    return hasActiveLink(item, activeLink);
  };

  return (
    <Flex direction="column" minHeight="100vh">
      <Header />
      <Flex as="main" flex="1" direction="column" alignItems="center">
        <Container maxW="8xl" px={["1.5rem", "1.5rem", "3.75rem"]} width="100%">
          <Flex gap="8" py={["2rem", "2rem", "3rem"]}>
            <Box hideBelow="lg" width="16rem" flexShrink={0}>
              <Box position="sticky" top="6">
                <DocsSidenav
                  title="Documentation"
                  menuItems={menuItems}
                  activeLink={activeLink}
                  onSelectLink={handleSelectLink}
                  shouldStartOpen={shouldStartOpen}
                />
              </Box>
            </Box>

            <Box flex="1" minWidth="0">
              <Stack gap="1.5rem" maxW="90ch">
                {title && <Text textStyle="heading/display/L">{title}</Text>}
                {description && (
                  <Text textStyle="paragraph/XL/regular" color="fg.muted">
                    {description}
                  </Text>
                )}

                <ContentImageLightbox>{children}</ContentImageLightbox>

                <Box pt="4" borderTopWidth="1px">
                  <DocsPagination previous={previous} next={next} />
                </Box>
              </Stack>
            </Box>

            <Box hideBelow="xl" width="16rem" flexShrink={0}>
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

function hasActiveLink(item: DocsSidenavItem, activeLink: string): boolean {
  if (item.link === activeLink) return true;
  return item.items?.some((child) => hasActiveLink(child, activeLink)) ?? false;
}
