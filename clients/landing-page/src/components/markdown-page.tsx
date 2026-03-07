import { Box, Container } from "@chakra-ui/react";
import Markdown from "react-markdown";
import Footer from "./footer";
import Header from "./header";

interface MarkdownPageProps {
  content: string;
}

export const MarkdownPage = (props: MarkdownPageProps) => {
  const { content } = props;

  return (
    <Box height="100vh" bg="bg" color="fg" display="flex" flexDirection="column" overflow="hidden">
      <Header />
      <Box as="main" flex="1" overflowY="auto">
        <Container maxW="3xl" py={{ base: "20", md: "28" }}>
          <Box
            className="markdown-content"
            css={{
              "& h1": { fontSize: "2rem", fontWeight: 700, marginBottom: "1.5rem" },
              "& h2": { fontSize: "1.5rem", fontWeight: 600, marginTop: "2rem", marginBottom: "1rem" },
              "& h3": { fontSize: "1.25rem", fontWeight: 600, marginTop: "1.5rem", marginBottom: "0.75rem" },
              "& p": { marginBottom: "1rem", lineHeight: 1.7 },
              "& ul": { paddingLeft: "1.5rem", marginBottom: "1rem" },
              "& li": { marginBottom: "0.5rem", lineHeight: 1.7 },
              "& a": { textDecoration: "underline" },
              "& em": { fontStyle: "italic" },
              "& strong": { fontWeight: 600 },
            }}
          >
            <Markdown>{content}</Markdown>
          </Box>
        </Container>
        <Footer
          links={[
            {
              title: "Legal",
              list: [
                { item: "Privacy Policy", url: "/privacy-policy/" },
                { item: "Terms", url: "/terms/" },
              ],
            },
          ]}
        />
      </Box>
    </Box>
  );
};
