import { Box, Stack, Text } from "@chakra-ui/react";
import { ChakraProvider, Header, psTheme } from "@pstdio/ui";
import { useState } from "react";
import { LetterToolbarControls } from "./letter-toolbar-controls";

export default {
  title: "Extensions/Fixtures/Mailbox header",
  description: "Custom webview controls use the shared components in both page and short tab headers.",
};
export const PageAndTabHeaders = () => {
  const [search, setSearch] = useState("");
  const [result, setResult] = useState("");
  return (
    <ChakraProvider value={psTheme}>
      <Stack w="full" minW="0" gap="md">
        {(["main", "narrow"] as const).map((variant) => (
          <Header key={variant} variant={variant}>
            <Text flexShrink="0">{variant === "main" ? "Mailbox / Letter A" : "Letter A"}</Text>
            <Box flex="1" minW="0" h="full">
              <LetterToolbarControls
                search={search}
                onSearchChange={setSearch}
                resource="A"
                result={result}
                onReadContext={() => setResult("A")}
              />
            </Box>
          </Header>
        ))}
      </Stack>
    </ChakraProvider>
  );
};
