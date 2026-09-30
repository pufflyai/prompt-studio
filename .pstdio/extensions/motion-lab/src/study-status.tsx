import { Text } from "@chakra-ui/react";
export const StudyStatus = (props: { message: string }) => {
  const { message } = props;
  return (
    <Text role="alert" color="fg.error" p="sm" whiteSpace="pre-wrap">
      {message}
    </Text>
  );
};
