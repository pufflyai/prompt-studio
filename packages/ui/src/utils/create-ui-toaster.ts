import { createToaster } from "@chakra-ui/react";

export const createUiToaster: () => ReturnType<typeof createToaster> = () =>
  createToaster({
    placement: "top",
    pauseOnPageIdle: true,
    duration: 10000,
    offsets: {
      top: "var(--pstdio-toast-top-offset, var(--chakra-spacing-md))",
      bottom: "var(--chakra-spacing-md)",
      left: "var(--chakra-spacing-md)",
      right: "var(--chakra-spacing-md)",
    },
  });
