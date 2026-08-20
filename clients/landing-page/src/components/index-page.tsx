import { Box, Container, Heading, HStack, IconButton, Stack, Text } from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import { createCopyFeedbackController } from "../utils/copy-feedback";
import { CopyCommandIcon } from "./copy-command-icon";
import Footer from "./footer";
import Header from "./header";
import { RootProvider } from "./root-provider";

const command = "npm i -g pstdio@latest";

const IndexPageContent = () => {
  const [isCopied, setIsCopied] = useState(false);
  const copyFeedbackControllerRef = useRef<ReturnType<typeof createCopyFeedbackController> | null>(null);

  if (!copyFeedbackControllerRef.current) {
    copyFeedbackControllerRef.current = createCopyFeedbackController(setIsCopied);
  }

  const copyFeedbackController = copyFeedbackControllerRef.current;

  useEffect(() => {
    return () => {
      copyFeedbackController.dispose();
    };
  }, [copyFeedbackController]);

  const handleCopyCommand = async () => {
    await navigator.clipboard.writeText(command);
    copyFeedbackController.markCopied();
  };

  return (
    <Box minH="100vh" bg="bg" color="fg" display="flex" flexDirection="column">
      <Header />
      <Box as="main" flex="1" display="flex">
        <Container maxW="4xl" px={{ base: "8", md: "4" }} py={{ base: "20", md: "28" }} flex="1" display="flex">
          <Stack gap="10" align="center" justify="center" textAlign="center" width="100%">
            <Heading as="h1" textStyle="heading/XL" maxW="4xl">
              Prompt Studio is a workbench where you and your agents can build and run custom tools for the way you
              work.
            </Heading>
            <HStack px="lg" py="xs" rounded="sm" borderWidth="1px" borderColor="border" bg="bg.subtle">
              <Text as="code" fontFamily="mono">
                {command}
              </Text>
              <IconButton aria-label="Copy command" variant="ghost" size="sm" onClick={handleCopyCommand}>
                <CopyCommandIcon isCopied={isCopied} />
              </IconButton>
            </HStack>
          </Stack>
        </Container>
      </Box>
      <Footer
        links={[
          { item: "GitHub", url: "https://github.com/pufflyai/prompt-studio" },
          { item: "Discord", url: "https://discord.gg/3RxwUEk8fW" },
          { item: "Privacy Policy", url: "/privacy-policy/" },
          { item: "Terms", url: "/terms/" },
        ]}
      />
    </Box>
  );
};

export const IndexPage = () => {
  return (
    <RootProvider>
      <IndexPageContent />
    </RootProvider>
  );
};
