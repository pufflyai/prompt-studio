import { Badge, HStack, Image } from "@chakra-ui/react";
import type { Param } from "./param-editor.types";
import { ParamEditorControlItem } from "./param-editor-control-item";
import { ParamEditorReadOnlyValue } from "./param-editor-read-only-value";

interface ParamEditorReadOnlyFieldProps {
  param: Extract<Param, { type: "readOnly" }>;
  fullWidth?: boolean;
}

const formatPrimitive = (value: string | number | boolean | null) => {
  if (value === null || value === "") return "Not provided";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
};

const ReadOnlyContent = (props: Pick<ParamEditorReadOnlyFieldProps["param"], "value">) => {
  const { value } = props;

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <ParamEditorReadOnlyValue color="fg.muted">None</ParamEditorReadOnlyValue>;
    }

    return (
      <HStack gap="2xs" flexWrap="wrap">
        {value.map((item, index) => (
          <Badge key={`${String(item)}-${index}`} variant="subtle" colorPalette="gray">
            {formatPrimitive(item)}
          </Badge>
        ))}
      </HStack>
    );
  }

  if (typeof value === "object" && value !== null) {
    const images = value.type === "image" ? [{ src: value.src, alt: value.alt }] : value.images;
    return (
      <HStack gap="2xs" flexWrap="wrap">
        {images.map((image) => (
          <Image
            key={`${image.src}-${image.alt}`}
            src={image.src}
            alt={image.alt}
            width="96px"
            height="72px"
            borderRadius="sm"
            borderWidth="1px"
            borderColor="border.subtle"
            objectFit="cover"
          />
        ))}
      </HStack>
    );
  }

  if (typeof value === "boolean") {
    return (
      <Badge variant="subtle" colorPalette={value ? "green" : "gray"} width="fit-content">
        {formatPrimitive(value)}
      </Badge>
    );
  }

  return (
    <ParamEditorReadOnlyValue color={value === null || value === "" ? "fg.muted" : "fg"}>
      {formatPrimitive(value)}
    </ParamEditorReadOnlyValue>
  );
};

export const ParamEditorReadOnlyField = (props: ParamEditorReadOnlyFieldProps) => {
  const { param, fullWidth } = props;

  return (
    <ParamEditorControlItem name={param.name} description={param.description} fullWidth={fullWidth}>
      <ReadOnlyContent value={param.value} />
    </ParamEditorControlItem>
  );
};
