import { Box, Carousel, IconButton, Image, Text } from "@chakra-ui/react";
import { ChevronLeft, ChevronRight, ImageOff } from "lucide-react";
import { type ReactNode, useState } from "react";
import { ScopedPopover as Popover } from "@/utils/scoped-overlays";
import { Portal } from "@/utils/ui-scope";

export interface ImageViewerImage {
  src: string;
  alt?: string;
}

export interface ImageViewerProps {
  images: ImageViewerImage[];
  /** Image shown first, such as the thumbnail that was clicked. */
  initialIndex?: number;
  /** The trigger, usually a thumbnail button. */
  children: ReactNode;
  placement?: "bottom-start" | "bottom" | "top" | "right-start";
}

const SLIDE_HEIGHT = "min(360px, 60vh)";

const ImageViewerSlide = (props: { image: ImageViewerImage }) => {
  const { image } = props;
  const [failed, setFailed] = useState(false);
  return (
    <Box position="relative" height={SLIDE_HEIGHT} bg="bg.muted" display="grid" placeItems="center">
      {failed ? (
        <Box color="fg.subtle" display="grid" placeItems="center" gap="2xs">
          <ImageOff size={20} />
          <Text textStyle="label/XS/regular">
            {image.alt ? `${image.alt} could not be loaded` : "Image could not be loaded"}
          </Text>
        </Box>
      ) : (
        <Image
          src={image.src}
          alt={image.alt ?? ""}
          maxW="full"
          maxH="full"
          objectFit="contain"
          draggable={false}
          onError={() => setFailed(true)}
        />
      )}
      {image.alt && !failed ? (
        <Text
          position="absolute"
          insetX="0"
          bottom="0"
          paddingX="sm"
          paddingY="xs"
          textStyle="label/XS/regular"
          color="white"
          bgGradient="to-t"
          gradientFrom="blackAlpha.700"
          gradientTo="transparent"
          truncate
        >
          {image.alt}
        </Text>
      ) : null}
    </Box>
  );
};

const navButtonProps = {
  size: "xs",
  variant: "solid",
  colorPalette: "gray",
  bg: "blackAlpha.600",
  color: "white",
  _hover: { bg: "blackAlpha.800" },
  _disabled: { opacity: 0, pointerEvents: "none" },
} as const;

/** Several images, one at a time, using the Chakra carousel: previous/next controls, dragging and a position counter. */
const ImageViewerCarousel = (props: { images: ImageViewerImage[]; initialIndex: number }) => {
  const { images, initialIndex } = props;
  return (
    <Carousel.Root slideCount={images.length} defaultPage={initialIndex} gap="0" allowMouseDrag>
      <Carousel.ItemGroup gap="0">
        {images.map((image, index) => (
          <Carousel.Item key={`${image.src}-${index}`} index={index}>
            <ImageViewerSlide image={image} />
          </Carousel.Item>
        ))}
      </Carousel.ItemGroup>
      <Carousel.Control
        position="absolute"
        width="auto"
        insetX="xs"
        top="50%"
        transform="translateY(-50%)"
        justifyContent="space-between"
        pointerEvents="none"
      >
        <Carousel.PrevTrigger asChild>
          <IconButton aria-label="Previous image" pointerEvents="auto" {...navButtonProps}>
            <ChevronLeft />
          </IconButton>
        </Carousel.PrevTrigger>
        <Carousel.NextTrigger asChild>
          <IconButton aria-label="Next image" pointerEvents="auto" {...navButtonProps}>
            <ChevronRight />
          </IconButton>
        </Carousel.NextTrigger>
      </Carousel.Control>
      <Carousel.ProgressText
        position="absolute"
        top="xs"
        insetInlineEnd="xs"
        paddingX="xs"
        borderRadius="xs"
        bg="blackAlpha.600"
        color="white"
        textStyle="label/XS/medium"
      />
    </Carousel.Root>
  );
};

/** The viewer's body: one image, or a carousel starting at `initialIndex`. */
export const ImageViewerContent = (props: { images: ImageViewerImage[]; initialIndex?: number }) => {
  const { images, initialIndex = 0 } = props;
  if (images.length === 1) return <ImageViewerSlide image={images[0]!} />;
  return <ImageViewerCarousel images={images} initialIndex={Math.min(initialIndex, images.length - 1)} />;
};

/**
 * The shared image viewer: a popover without padding that shows one image, or a carousel for
 * several. Use it wherever a thumbnail opens a larger image.
 */
export const ImageViewer = (props: ImageViewerProps) => {
  const { images, initialIndex = 0, children, placement = "bottom-start" } = props;
  if (images.length === 0) return <>{children}</>;
  return (
    <Popover.Root positioning={{ placement, offset: { mainAxis: 6 } }} lazyMount unmountOnExit>
      <Popover.Trigger asChild>{children}</Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content
            width="min(480px, calc(100vw - 32px))"
            padding="0"
            overflow="hidden"
            background="bg"
            data-testid="image-viewer"
            // Portaled content still bubbles React events to the trigger's ancestors, such as a table row.
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <ImageViewerContent images={images} initialIndex={initialIndex} />
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
};
