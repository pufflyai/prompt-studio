import { Box, Stack, Text } from "@chakra-ui/react";
import { useEffect, useState } from "react";

interface SourceInformation {
  code: string;
  hash: string;
  component?: string;
  componentImport?: string;
}
export const PreviewSource = (props: { source: string }) => {
  const { source } = props;
  const [information, setInformation] = useState<SourceInformation>();
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    import("./generated/source-information.json")
      .then((module) => {
        const sources: Record<string, SourceInformation> = module.default;
        if (active) setInformation(sources[source]);
      })
      .catch((error) => {
        if (active) setError(String(error));
      });
    return () => {
      active = false;
    };
  }, [source]);
  if (error)
    return (
      <Text role="alert" data-ui-canvas-error color="fg.error">
        {error}
      </Text>
    );
  if (!information) return <Text>Loading source…</Text>;
  return (
    <Stack gap="sm">
      {information.component && (
        <Text textStyle="label/S/medium">
          {information.component} · {information.componentImport}
        </Text>
      )}
      <Text textStyle="mono/XS" overflowWrap="anywhere">
        SHA-256: {information.hash}
      </Text>
      <Box as="pre" textStyle="mono/XS" whiteSpace="pre-wrap" overflowWrap="anywhere">
        {information.code}
      </Box>
    </Stack>
  );
};
