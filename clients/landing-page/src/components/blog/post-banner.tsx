import { Box, Image } from "@chakra-ui/react";
import type { LandingPage } from "../../content/landing-pages";
import { useDocStyles } from "../../hooks/use-landing-styles";

interface PostBannerProps {
  image: Extract<LandingPage, { view: "post" }>["image"];
  loading?: "eager" | "lazy";
}

export const PostBanner = (props: PostBannerProps) => {
  const { image, loading = "eager" } = props;
  const styles = useDocStyles();

  return (
    <Box as="span" css={styles.postArtwork}>
      {(["light", "dark"] as const).map((tone) => (
        <Image
          key={tone}
          data-art-tone={tone}
          src={image[tone].src}
          htmlWidth={image[tone].width}
          htmlHeight={image[tone].height}
          alt=""
          loading={loading}
          decoding="async"
          css={styles.postBanner}
        />
      ))}
    </Box>
  );
};
