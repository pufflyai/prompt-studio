import { Text } from "@chakra-ui/react";

/** Keep both ends of an identity readable without pushing adjacent actions out of view. */
export const ExtensionIdentity = (props: { value: string }) => {
  const { value } = props;
  const split = Math.max(0, value.length - 16);
  return (
    <Text textStyle="label/XS" fontFamily="mono" color="fg.subtle" display="flex" minW="0" title={value}>
      <Text as="span" minW="0" truncate>
        {value.slice(0, split)}
      </Text>
      <Text as="span" flexShrink="0">
        {value.slice(split)}
      </Text>
    </Text>
  );
};
