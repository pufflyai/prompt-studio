import { Box, CloseButton, Dialog } from "@chakra-ui/react";
import type { MouseEvent, ReactNode } from "react";
import { useState } from "react";

interface ContentImageLightboxProps {
  children: ReactNode;
}

interface LightboxImage {
  alt: string;
  src: string;
}

export const ContentImageLightbox = (props: ContentImageLightboxProps) => {
  const { children } = props;
  const [image, setImage] = useState<LightboxImage | null>(null);

  const handleClickCapture = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const clickedImage = target.closest("img");
    if (!(clickedImage instanceof HTMLImageElement)) return;

    const src = clickedImage.currentSrc || clickedImage.src;
    if (!src) return;

    event.preventDefault();

    setImage({
      alt: clickedImage.alt,
      src,
    });
  };

  return (
    <>
      <Box onClickCapture={handleClickCapture}>{children}</Box>

      <Dialog.Root
        lazyMount
        open={Boolean(image)}
        onOpenChange={(details) => {
          if (!details.open) {
            setImage(null);
          }
        }}
      >
        <Dialog.Backdrop bg="blackAlpha.800" backdropFilter="blur(4px)" />
        <Dialog.Positioner p={{ base: "4", md: "8" }}>
          <Dialog.Content bg="transparent" borderWidth="0" boxShadow="none" maxW="none">
            <Dialog.CloseTrigger asChild>
              <CloseButton
                size="lg"
                position="fixed"
                top={{ base: "4", md: "6" }}
                right={{ base: "4", md: "6" }}
                color="white"
                bg="blackAlpha.600"
                _hover={{ bg: "blackAlpha.700" }}
              />
            </Dialog.CloseTrigger>

            <Dialog.Body p="0" display="flex" justifyContent="center" alignItems="center">
              {image ? (
                <Box
                  as="img"
                  src={image.src}
                  alt={image.alt}
                  maxW="min(96vw, 1400px)"
                  maxH="calc(100vh - 4rem)"
                  width="auto"
                  height="auto"
                  objectFit="contain"
                  borderRadius="md"
                  boxShadow="2xl"
                />
              ) : null}
            </Dialog.Body>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </>
  );
};
