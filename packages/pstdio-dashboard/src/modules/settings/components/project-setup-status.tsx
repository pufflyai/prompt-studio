import { Button, Stack, Text } from "@chakra-ui/react";

interface ProjectSetupStatusProps {
  error: string;
  retrying?: boolean;
  onRetry: () => void;
}

export const ProjectSetupStatus = (props: ProjectSetupStatusProps) => {
  const { error, retrying, onRetry } = props;
  return (
    <Stack gap="sm">
      <Text role="alert" color="fg.error">
        {error}
      </Text>
      <Text color="fg.muted">Project setup is incomplete. Retry after fixing the error.</Text>
      <Button variant="outline" loading={retrying} onClick={onRetry}>
        Retry setup
      </Button>
    </Stack>
  );
};
