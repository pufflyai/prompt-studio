import { HStack, Input, Spinner } from "@chakra-ui/react";
import { AlertMessage, CopyButton, ScrollArea } from "@pstdio/ui";

interface DocumentLinkContentProps {
  href: string;
  label: string;
  loading?: boolean;
  error?: string;
}

export const DocumentLinkContent = (props: DocumentLinkContentProps) => {
  const { href, label, loading, error } = props;
  return (
    <ScrollArea h="full" minH="0" contentProps={{ p: "md" }}>
      {error ? (
        <AlertMessage status="error" title={error} />
      ) : (
        <HStack gap="sm">
          <Input size="sm" aria-label={label} value={href} readOnly />
          {loading ? <Spinner size="sm" /> : <CopyButton text={href} label={label} />}
        </HStack>
      )}
    </ScrollArea>
  );
};
