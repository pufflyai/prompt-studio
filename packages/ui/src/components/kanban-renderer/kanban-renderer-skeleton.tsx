import { HStack, Skeleton, type SkeletonProps, Stack, useSlotRecipe } from "@chakra-ui/react";
import type { KanbanRendererSettings } from "./types";

interface KanbanRendererSkeletonProps {
  viewMode: KanbanRendererSettings["viewMode"];
}

// Fixed widths keep the placeholder layout identical on every mount.
const columnLabelWidths = ["4rem", "3rem", "5rem", "3.5rem"];
const cardTitleWidths = [["full", "7.5rem"], ["full"], ["full", "6rem"], ["full", "8.75rem"]];
const rowTitleWidths = ["20rem", "15rem", "17.5rem", "12.5rem", "22.5rem", "16.25rem"];

const Bar = (props: SkeletonProps) => <Skeleton height="3" borderRadius="xs" flexShrink={0} {...props} />;

const ViewBarSkeleton = () => (
  <HStack height="view-bar" gap="sm" paddingX="xs" borderBottomWidth="1px" borderColor="border.subtle">
    <Bar width="4.5rem" />
    <Bar width="3.5rem" />
    <Bar width="4rem" />
  </HStack>
);

const BoardSkeleton = () => {
  const columnStyles = useSlotRecipe({ key: "kanbanBoardColumn" })();
  return (
    <HStack flex="1" minH="0" alignItems="stretch" gap="xs" padding="xs" overflow="hidden">
      {columnLabelWidths.map((labelWidth, column) => (
        <Stack
          key={column}
          gap="xs"
          css={columnStyles.root}
          borderWidth="1px"
          borderColor="border.subtle"
          borderRadius="sm"
          background="bg.subtle"
          minW="260px"
          flex="1 0 260px"
        >
          <HStack css={columnStyles.header} minH="1.5rem" gap="2xs">
            <Skeleton boxSize="3.5" borderRadius="full" />
            <Bar width={labelWidth} />
          </HStack>
          {Array.from({ length: 3 - (column % 2) }, (_, card) => (
            <Stack key={card} css={columnStyles.entry}>
              <Stack
                gap="xs"
                padding="compact"
                borderRadius="compact"
                borderWidth="1px"
                borderColor="border"
                background="bg"
              >
                <Bar width="2rem" height="2.5" />
                {cardTitleWidths[(column + card) % cardTitleWidths.length].map((width) => (
                  <Bar key={width} width={width} />
                ))}
                <HStack gap="2xs">
                  <Bar width="2.75rem" height="4" />
                  <Bar width="1.75rem" height="4" />
                </HStack>
              </Stack>
            </Stack>
          ))}
        </Stack>
      ))}
    </HStack>
  );
};

const ListSkeleton = () => (
  <Stack flex="1" minH="0" gap="0" overflow="hidden">
    {Array.from({ length: 12 }, (_, row) => (
      <HStack
        key={row}
        height="collection-row"
        gap="xs"
        paddingX="sm"
        borderBottomWidth="1px"
        borderColor="border.subtle"
      >
        <Skeleton boxSize="4" borderRadius="full" flexShrink={0} />
        <Bar width="2rem" height="2.5" />
        <Bar width={rowTitleWidths[row % rowTitleWidths.length]} maxW="50%" />
        <Bar width="2.75rem" height="4" marginLeft="auto" />
        <Bar width="2.25rem" height="2.5" />
      </HStack>
    ))}
  </Stack>
);

/** Stands in for the whole renderer until it knows its views and fields, so no label shows a raw id. */
export const KanbanRendererSkeleton = (props: KanbanRendererSkeletonProps) => {
  const { viewMode } = props;
  return (
    <Stack
      role="region"
      aria-busy="true"
      aria-label="Loading"
      height="100%"
      minH="0"
      gap="0"
      background="bg"
      overflow="hidden"
    >
      <ViewBarSkeleton />
      {viewMode === "board" ? <BoardSkeleton /> : <ListSkeleton />}
    </Stack>
  );
};
