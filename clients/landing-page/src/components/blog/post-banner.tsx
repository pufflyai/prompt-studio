import { Image } from "@chakra-ui/react";
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
    <Image
      src={image.src}
      htmlWidth={image.width}
      htmlHeight={image.height}
      alt=""
      loading={loading}
      decoding="async"
      css={styles.postBanner}
    />
  );
};
