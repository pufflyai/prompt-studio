import { Box, HStack, Image } from "@chakra-ui/react";
import greatWave from "../../../assets/great-wave.jpg";
import { ExampleIcon } from "../../icon";
import type { MarmaladeLayer } from "./marmalade.types";

export const greatWaveImage = new URL(greatWave, import.meta.url).href;
export const MarmaladePreview = (props: { layer: MarmaladeLayer }) => {
  const { layer } = props;
  return (
    <HStack gap="2xs" aria-label={layer.mask ? "Image and mask previews" : undefined}>
      <Box
        boxSize="5"
        bg="bg.subtle"
        borderWidth="1px"
        borderColor="border.subtle"
        borderRadius="xs"
        display="grid"
        placeItems="center"
        overflow="hidden"
      >
        {layer.kind === "image" && !layer.disabled ? (
          <Image src={greatWaveImage} alt="" boxSize="full" objectFit="cover" />
        ) : (
          <ExampleIcon name={layer.kind === "group" ? "Folder" : "Type"} />
        )}
      </Box>
      {layer.mask ? (
        <Box
          w="4"
          h="5"
          bg="fg"
          borderWidth="1px"
          borderColor="border.subtle"
          borderRadius="xs"
          aria-label="Full-image mask preview"
        />
      ) : null}
    </HStack>
  );
};
