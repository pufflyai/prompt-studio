import { Toaster as ChakraToaster, createToaster, Portal, Spinner, Stack, Toast } from "@chakra-ui/react";

export const toaster: ReturnType<typeof createToaster> = createToaster({
  placement: "bottom-end",
  pauseOnPageIdle: true,
  duration: 10000,
});

export const Toaster = () => {
  return (
    <Portal>
      <ChakraToaster toaster={toaster} insetInline={{ mdDown: "4" }}>
        {(toast) => (
          <Toast.Root width={{ md: "sm" }} alignItems="start">
            {toast.type === "loading" ? <Spinner size="sm" color="blue.solid" /> : <Toast.Indicator />}
            <Stack gap="1" flex="1" minWidth="0" maxWidth="100%">
              {toast.title && <Toast.Title>{toast.title}</Toast.Title>}
              {toast.description && (
                <Toast.Description
                  maxHeight="12rem"
                  overflowY="auto"
                  paddingEnd="1"
                  whiteSpace="pre-wrap"
                  wordBreak="break-word"
                >
                  {toast.description}
                </Toast.Description>
              )}
            </Stack>
            {toast.action && <Toast.ActionTrigger>{toast.action.label}</Toast.ActionTrigger>}
            {toast.closable && <Toast.CloseTrigger />}
          </Toast.Root>
        )}
      </ChakraToaster>
    </Portal>
  );
};
