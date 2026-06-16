import type { HTMLChakraProps } from "@chakra-ui/react";
import { chakra, Text } from "@chakra-ui/react";
import { Tooltip } from "@pstdio/ui";
import { Link as LinkIcon } from "lucide-react";
import { type ReviewLinkValue, reviewLinkLabel, reviewLinkTooltip } from "./review-link-values";

interface ReviewLinkBadgeProps extends Omit<HTMLChakraProps<"a">, "title"> {
  link: ReviewLinkValue;
}

export const ReviewLinkBadge = (props: ReviewLinkBadgeProps) => {
  const { link, ...rest } = props;
  const label = reviewLinkLabel(link);
  const title = reviewLinkTooltip(link);

  return (
    <chakra.a
      href={link.url}
      target="_blank"
      rel="noreferrer"
      aria-label={title}
      display="inline-flex"
      alignItems="center"
      h="20px"
      minW="0"
      gap="2xs"
      px="2xs"
      borderRadius="xs"
      borderWidth="1px"
      borderColor="border"
      bg="bg.muted"
      color="fg"
      cursor="pointer"
      lineHeight={{ base: "20px" }}
      textDecoration="none"
      _hover={{ bg: "bg.emphasized", textDecoration: "none" }}
      onClick={(event) => event.stopPropagation()}
      {...rest}
    >
      <chakra.span display="inline-flex" color="fg.muted">
        <LinkIcon size={12} />
      </chakra.span>
      <Tooltip content={title}>
        <Text as="span" maxW="14rem" textStyle="xs" textOverflow="ellipsis" whiteSpace="nowrap" overflow="hidden">
          {label}
        </Text>
      </Tooltip>
    </chakra.a>
  );
};
