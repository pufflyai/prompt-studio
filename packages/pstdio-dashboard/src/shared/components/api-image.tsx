import { Image, type ImageProps } from "@chakra-ui/react";
import { useApiFileUrl } from "@/lib/api-file-url";

interface ApiImageProps extends ImageProps {
  src: string;
}

/** An image that can load files from the API, which need the browser session header. */
export const ApiImage = (props: ApiImageProps) => {
  const { src, ...imageProps } = props;
  return <Image {...imageProps} src={useApiFileUrl(src)} />;
};
