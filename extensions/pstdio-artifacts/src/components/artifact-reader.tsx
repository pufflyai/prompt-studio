import { Stack } from "@chakra-ui/react";
import type { ArtifactContent } from "../artifacts";
import { useArtifactTranslations } from "../translations";
import { HtmlPreview } from "./html-preview";

export const ArtifactReader = (props: { content: ArtifactContent }) => {
  const { t } = useArtifactTranslations();
  return (
    <Stack height="full" minHeight="0" gap="0">
      <HtmlPreview
        key={props.content.id}
        html={props.content.html}
        title={t("reader.preview", "Preview: {{title}}", { title: props.content.title })}
      />
    </Stack>
  );
};
