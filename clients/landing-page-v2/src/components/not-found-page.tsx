import { Button, Container, Stack } from "@chakra-ui/react";
import { EmptyState } from "@pstdio/ui";
import { RootProvider } from "./root-provider";

export const NotFoundPage = () => {
  return (
    <RootProvider>
      <Container as="main" maxW="3xl" py={{ base: "20", md: "28" }}>
        <Stack align={"center"}>
          <EmptyState
            title="Page not found"
            description="The page you requested does not exist or has moved to a new path."
          />
          <Button variant="solid" asChild>
            <a href="/">Go back home</a>
          </Button>
        </Stack>
      </Container>
    </RootProvider>
  );
};
