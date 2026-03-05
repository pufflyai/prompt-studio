import { Center, Spinner } from "@chakra-ui/react";

export const LoadingDocs = () => {
  return (
    <Center width="100%" minH="240px" height="100%">
      <Spinner size="sm" />
    </Center>
  );
};
