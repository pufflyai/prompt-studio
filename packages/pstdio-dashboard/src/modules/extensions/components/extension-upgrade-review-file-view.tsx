import { Box, Button, Field, HStack, Stack, Text, Textarea } from "@chakra-ui/react";
import { AlertMessage, LoadingState } from "@pstdio/ui";
import type {
  ExtensionUpgradeReview,
  ExtensionUpgradeReviewFile,
  ExtensionUpgradeReviewResolution,
} from "pstdio-api-contracts";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getApiClient } from "@/lib/api";

export const ExtensionUpgradeReviewFileView = (props: {
  projectId: string;
  instanceId: string;
  id: string;
  revision: string;
  disabled: boolean;
  change: ExtensionUpgradeReview["changes"][number];
  choice: ExtensionUpgradeReviewResolution | undefined;
  onChoose: (choice: ExtensionUpgradeReviewResolution) => void;
}) => {
  const { projectId, instanceId, id, revision, disabled, change, choice, onChoose } = props;
  const { path } = change;
  const { t } = useTranslation("projects", { keyPrefix: "projectSettings.extensionsPanel.upgradeReview" });
  const [file, setFile] = useState<ExtensionUpgradeReviewFile>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    let current = true;
    getApiClient()
      .extensions.reviewUpgrade(projectId, instanceId, { action: "file", id, path, revision })
      .then(
        ({ file: result }) => {
          if (current) setFile(result);
        },
        (failure: unknown) => {
          if (current) setError(failure instanceof Error ? failure.message : String(failure));
        },
      );
    return () => {
      current = false;
    };
  }, [projectId, instanceId, id, path, revision]);
  if (error)
    return (
      <AlertMessage status="error" title={path}>
        {error}
      </AlertMessage>
    );
  if (!file) return <LoadingState />;
  const textFile = file.local !== null || file.incoming !== null;
  return (
    <Stack gap="sm">
      <Text fontWeight="semibold" overflowWrap="anywhere">
        {path}
      </Text>
      {change.status === "conflict" && (
        <HStack wrap="wrap">
          <Button
            variant={choice?.kind === "local" ? "outline" : "ghost"}
            disabled={disabled}
            onClick={() => onChoose({ path, kind: "local" })}
          >
            {t("local", "Keep local")}
          </Button>
          <Button
            variant={choice?.kind === "incoming" ? "outline" : "ghost"}
            disabled={disabled}
            onClick={() => onChoose({ path, kind: "incoming" })}
          >
            {t("incoming", "Use incoming")}
          </Button>
          {textFile && (
            <Button
              variant={choice?.kind === "text" ? "outline" : "ghost"}
              disabled={disabled}
              onClick={() => onChoose({ path, kind: "text", text: file.local ?? file.incoming ?? "" })}
            >
              {t("edit", "Edit result")}
            </Button>
          )}
        </HStack>
      )}
      {choice?.kind === "text" && (
        <Field.Root>
          <Field.Label>{t("proposed", "Proposed result")}</Field.Label>
          <Textarea
            value={choice.text}
            fontFamily="mono"
            rows={8}
            disabled={disabled}
            onChange={(event) => onChoose({ path, kind: "text", text: event.target.value })}
          />
        </Field.Root>
      )}
      {(
        [
          [t("original", "Original release"), file.base],
          [t("localSnapshot", "Local copy"), file.local],
          [t("incomingSnapshot", "Incoming release"), file.incoming],
          [t("proposed", "Proposed result"), change.status === "merged" ? file.proposed : null],
        ] as const
      ).map(
        ([label, content]) =>
          content !== null && (
            <Box key={label} borderWidth="1px" borderRadius="sm" p="sm" minW="0">
              <Text mb="xs" fontWeight="semibold">
                {label}
              </Text>
              <Box as="pre" fontFamily="mono" overflow="auto" maxH="12rem" fontSize="sm">
                {content}
              </Box>
            </Box>
          ),
      )}
      {!textFile && <Text color="fg.muted">{t("nonText", "Text preview is unavailable for this change.")}</Text>}
    </Stack>
  );
};
