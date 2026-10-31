import { HStack, Text } from "@chakra-ui/react";

export const SectionLabel = (props: { title: string; detail?: string }) => {
  const { title, detail } = props;
  return (
    <HStack justifyContent="space-between" paddingBottom="2xs">
      <Text textStyle="label/XS/caps" color="fg.subtle">
        {title}
      </Text>
      {detail ? (
        <Text textStyle="label/2XS" color="fg.subtle">
          {detail}
        </Text>
      ) : null}
    </HStack>
  );
};
