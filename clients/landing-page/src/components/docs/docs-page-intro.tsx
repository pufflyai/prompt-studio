import { Badge, Heading, Stack, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";

interface DocsPageIntroProps {
  badge: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}

export const DocsPageIntro = (props: DocsPageIntroProps) => {
  const { badge, title, description, actions } = props;

  return (
    <Stack gap="5" borderBottomWidth="1px" pb="8">
      <Badge alignSelf="flex-start" colorPalette="gray" variant="subtle">
        {badge}
      </Badge>
      <Heading as="h1" fontSize={{ base: "3xl", md: "4xl" }} lineHeight="1.1" fontWeight="600" letterSpacing="0">
        {title}
      </Heading>
      {description ? (
        <Text color="fg.muted" fontSize={{ base: "lg", md: "xl" }} lineHeight="1.7" maxW="70ch">
          {description}
        </Text>
      ) : null}
      {actions}
    </Stack>
  );
};
