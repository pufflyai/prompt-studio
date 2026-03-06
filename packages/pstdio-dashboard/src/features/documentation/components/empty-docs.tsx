import { Center } from "@chakra-ui/react";
import { EmptyState } from "@pstdio/ui";

export const EmptyDocs = () => {
  return (
    <Center width="100%" minH="240px" height="100%">
      <EmptyState title="No docs found" description="" />
    </Center>
  );
};
