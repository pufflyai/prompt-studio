import { Box } from "@chakra-ui/react";
import type { GuestHost, PropsStore } from "@pstdio/sdk/extensions";
import type { ComponentType } from "react";
import { ReviewContext, type ReviewProps, useReviewConnection } from "./review-context";
import { StudyStatus } from "./study-status";

interface RootProps {
  Component: ComponentType;
  host: GuestHost;
  propsStore: PropsStore<ReviewProps>;
}
export const ReviewRoot = (props: RootProps) => {
  const { Component, host, propsStore } = props;
  const connection = useReviewConnection(host, propsStore);
  return (
    <Box h="full" w="full" minH="0" minW="0" overflow="hidden" bg="bg" color="fg">
      {connection.error && <StudyStatus message={connection.error} />}
      {connection.value && (
        <ReviewContext value={{ ...connection.value, preview: connection.preview, update: connection.update }}>
          <Component />
        </ReviewContext>
      )}
    </Box>
  );
};
