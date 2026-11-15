import { Box, chakra, HStack, Image, Stack, Text } from "@chakra-ui/react";
import type { DataTableRendererImageItem, DataTableRendererImageOptions } from "@pstdio/sdk/extensions";
import { ImageOff } from "lucide-react";
import { dataTableImageText, readDataTableImageValue } from "pstdio-api-contracts/collections";
import { useState } from "react";
import { ScopedPopover as Popover } from "@/utils/scoped-overlays";
import { Portal } from "@/utils/ui-scope";
import { HighlightedText } from "../collection-view/highlighted-text";

const MAX_VISIBLE_IMAGES = 3;
// Thumbnails fill the row, so Compact, Comfortable and Tall rows show growing previews.
const THUMBNAIL_SIZE = "calc(var(--table-row-height, 28px) - 8px)";
// Gallery thumbnails overlap by about half, so three thumbnails and "+N" fit a normal column.
const GALLERY_OVERLAP = `calc(${THUMBNAIL_SIZE} * -0.5)`;

interface ThumbnailProps {
  image: DataTableRendererImageItem;
  renderer: DataTableRendererImageOptions;
}

const Thumbnail = (props: ThumbnailProps) => {
  const { image, renderer } = props;
  const [failed, setFailed] = useState(false);
  const radius = renderer.shape === "circle" ? "full" : "xs";
  if (failed) {
    return (
      <Box
        boxSize={THUMBNAIL_SIZE}
        flexShrink={0}
        borderRadius={radius}
        borderWidth="1px"
        borderColor="border.subtle"
        bg="bg.muted"
        color="fg.subtle"
        display="grid"
        placeItems="center"
        title={image.alt ? `${image.alt} could not be loaded` : "Image could not be loaded"}
      >
        <ImageOff size={12} />
      </Box>
    );
  }
  return (
    <Image
      src={image.src}
      alt={image.alt ?? ""}
      boxSize={THUMBNAIL_SIZE}
      flexShrink={0}
      borderRadius={radius}
      borderWidth="1px"
      borderColor="border.subtle"
      bg="bg.muted"
      objectFit={renderer.fit ?? "cover"}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
};

interface DataTableImageCellProps {
  columnLabel: string;
  renderer: DataTableRendererImageOptions;
  value: unknown;
  search?: string;
}

const stopRowActivation = (event: { stopPropagation: () => void }) => event.stopPropagation();

/** Thumbnails for an image column. Clicking opens a larger preview without activating the row. */
export const DataTableImageCell = (props: DataTableImageCellProps) => {
  const { columnLabel, renderer, value, search = "" } = props;
  const images = readDataTableImageValue(value);
  if (images.length === 0) {
    return (
      <Text textStyle="paragraph/S/regular" color="fg.subtle">
        —
      </Text>
    );
  }
  const visible = images.slice(0, MAX_VISIBLE_IMAGES);
  const hiddenCount = images.length - visible.length;
  const label = images[0]?.alt;

  return (
    <Popover.Root positioning={{ placement: "bottom-start", offset: { mainAxis: 6 } }} lazyMount unmountOnExit>
      <Popover.Trigger asChild>
        <chakra.button
          type="button"
          aria-label={`View ${columnLabel}: ${dataTableImageText(value) || "image"}`}
          display="flex"
          alignItems="center"
          gap="xs"
          minW="0"
          maxW="full"
          height="full"
          cursor="zoom-in"
          borderRadius="xs"
          _focusVisible={{ outline: "2px solid", outlineColor: "colorPalette.focusRing" }}
          onClick={stopRowActivation}
        >
          <HStack gap="0" minW="0" flexShrink={1}>
            {visible.map((image, index) => (
              <Box
                key={`${image.src}-${index}`}
                position="relative"
                zIndex={MAX_VISIBLE_IMAGES - index}
                flexShrink={0}
                marginInlineStart={index === 0 ? 0 : GALLERY_OVERLAP}
                borderRadius={renderer.shape === "circle" ? "full" : "xs"}
                boxShadow="0 0 0 2px var(--chakra-colors-bg)"
              >
                <Thumbnail image={image} renderer={renderer} />
                {/* The first thumbnail is never covered, so its "+N" stays visible in narrow columns. */}
                {index === 0 && hiddenCount > 0 ? (
                  <Text
                    position="absolute"
                    insetInlineEnd="2px"
                    bottom="2px"
                    paddingX="1"
                    borderRadius="xs"
                    bg="blackAlpha.700"
                    color="white"
                    textStyle="label/XS/medium"
                  >
                    +{hiddenCount}
                  </Text>
                ) : null}
              </Box>
            ))}
          </HStack>
          {renderer.showLabel && label ? (
            <Text textStyle="paragraph/S/regular" truncate>
              <HighlightedText text={label} query={search} />
            </Text>
          ) : null}
        </chakra.button>
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content width="min(360px, calc(100vw - 32px))" padding="xs" gap="xs" background="bg">
            {images.map((image, index) => (
              <Stack key={`${image.src}-${index}`} gap="2xs">
                <Image
                  src={image.src}
                  alt={image.alt ?? ""}
                  width="full"
                  maxH="240px"
                  objectFit="contain"
                  borderRadius="sm"
                  bg="bg.muted"
                />
                {image.alt ? (
                  <Text textStyle="paragraph/XS/regular" color="fg.muted">
                    {image.alt}
                  </Text>
                ) : null}
              </Stack>
            ))}
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
};
