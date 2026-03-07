import { Box, Button, HStack, Stack, Text } from "@chakra-ui/react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface DocsPaginationItem {
  href: string;
  title: string;
  description?: string;
}

export interface DocsPaginationProps {
  previous?: DocsPaginationItem;
  next?: DocsPaginationItem;
}

interface DocsPaginationLinkProps {
  item: DocsPaginationItem;
  direction: "prev" | "next";
}

const DocsPaginationLink = (props: DocsPaginationLinkProps) => {
  const { item, direction } = props;
  const isPrevious = direction === "prev";
  const directionText = isPrevious ? "Previous" : "Next";

  return (
    <Button
      asChild
      variant="ghost"
      colorPalette="gray"
      gap="3"
      size="sm"
      h="auto"
      py="2"
      textAlign={isPrevious ? "start" : "end"}
      justifyContent={isPrevious ? "flex-start" : "flex-end"}
      flex="1"
    >
      <a href={item.href}>
        {isPrevious ? <ChevronLeft size={16} /> : null}
        <Stack gap="0" alignItems={isPrevious ? "flex-start" : "flex-end"}>
          <Text textStyle="sm" color="fg.muted" fontWeight="normal">
            {directionText}
          </Text>
          <Text textStyle="sm" fontWeight="medium">
            {item.title}
          </Text>
          {item.description ? (
            <Text textStyle="xs" color="fg.subtle" fontWeight="normal">
              {item.description}
            </Text>
          ) : null}
        </Stack>
        {isPrevious ? null : <ChevronRight size={16} />}
      </a>
    </Button>
  );
};

export const DocsPagination = (props: DocsPaginationProps) => {
  const { previous, next } = props;

  if (!previous && !next) {
    return null;
  }

  return (
    <HStack justify="space-between" gap="4">
      <Box flex="1">{previous ? <DocsPaginationLink item={previous} direction="prev" /> : null}</Box>
      <Box flex="1">{next ? <DocsPaginationLink item={next} direction="next" /> : null}</Box>
    </HStack>
  );
};
