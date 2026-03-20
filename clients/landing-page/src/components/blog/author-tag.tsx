import { Flex, Image, Stack, Text } from "@chakra-ui/react";

interface AuthorTagProps {
  name: string;
  role: string;
  avatar?: string;
}

export const AuthorTag = (props: AuthorTagProps) => {
  const { name, role, avatar } = props;

  return (
    <Flex gap="3" alignItems="center" mt="2">
      <Flex
        alignItems="center"
        justifyContent="center"
        height="3rem"
        width="3rem"
        borderRadius="full"
        bg="bg.muted"
        overflow="hidden"
      >
        {avatar ? (
          <Image src={avatar} alt={name} width="100%" height="100%" objectFit="cover" />
        ) : (
          <Text textAlign="center">{name.slice(0, 2)}</Text>
        )}
      </Flex>
      <Stack gap="0.25">
        <Text textStyle="label/M/medium">{name}</Text>
        <Text textStyle="label/M/regular">{role}</Text>
      </Stack>
    </Flex>
  );
};
