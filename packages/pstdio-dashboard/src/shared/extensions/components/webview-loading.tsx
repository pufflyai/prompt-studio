import { Box, HStack, Skeleton, Stack } from "@chakra-ui/react";
import { LoadingState } from "@pstdio/ui";

// Pages and panels show the animated logo. Workbench chrome keeps its shape with a skeleton,
// so the action bar, navigation and status bar don't flash a centered loader.
export type WebviewLoadingKind = "page" | "icons" | "rows" | "line";

export const webviewLoadingKind = (region: string, contentSized: boolean): WebviewLoadingKind => {
  if (contentSized || region === "status" || region.endsWith("-header")) return "line";
  if (region === "nav" || region === "sidenav") return "rows";
  if (region === "activity" || region.endsWith("-menu")) return "icons";
  return "page";
};

// Fixed widths keep the placeholder identical on every mount.
const rowWidths = ["7rem", "5.5rem", "8.5rem", "6rem", "7.5rem", "5rem"];

const Placeholder = (props: { kind: WebviewLoadingKind }) => {
  const { kind } = props;
  if (kind === "page") return <LoadingState />;
  if (kind === "icons") {
    return (
      <Stack flex="1" align="center" gap="sm" paddingY="sm">
        {rowWidths.slice(0, 5).map((width) => (
          <Skeleton key={width} boxSize="6" borderRadius="xs" />
        ))}
      </Stack>
    );
  }
  if (kind === "rows") {
    return (
      <Stack flex="1" gap="sm" padding="sm">
        {rowWidths.map((width) => (
          <HStack key={width} gap="xs">
            <Skeleton boxSize="4" borderRadius="xs" flexShrink={0} />
            <Skeleton height="3" width={width} borderRadius="xs" />
          </HStack>
        ))}
      </Stack>
    );
  }
  return (
    <HStack flex="1" paddingX="2xs">
      <Skeleton height="3" width="full" minWidth="6" borderRadius="xs" />
    </HStack>
  );
};

export const WebviewLoading = (props: { kind: WebviewLoadingKind; background: string }) => {
  const { kind, background } = props;
  return (
    <Box position="absolute" inset="0" display="flex" bg={background} zIndex={1}>
      <Placeholder kind={kind} />
    </Box>
  );
};
