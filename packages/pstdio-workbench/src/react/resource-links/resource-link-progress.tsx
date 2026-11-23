import { Text } from "@chakra-ui/react";

export const ResourceLinkProgress = (props: { pending: boolean; unconfirmed: boolean }) => {
  if (!props.pending && !props.unconfirmed) return null;
  return (
    <Text role="status" color="fg.muted" textStyle="sm">
      {props.unconfirmed ? "A link change could not be confirmed." : "Saving link changes…"}
    </Text>
  );
};
