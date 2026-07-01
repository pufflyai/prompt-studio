import { Toaster as ChakraToaster, createToaster, Portal, Spinner, Stack, Toast } from "@chakra-ui/react";
import { ScrollArea } from "@/components/primitives/scroll-area";

export const toaster: ReturnType<typeof createToaster> = createToaster({
  placement: "top",
  pauseOnPageIdle: true,
  duration: 10000,
});

export const Toaster = () => {
  return (
    <Portal>
      <ChakraToaster toaster={toaster} insetInline={{ mdDown: "4" }}>
        {(toast) => (
          <Toast.Root width={{ md: "sm" }} alignItems="start" borderRadius="xs" gap="xs" px="sm" py="xs" minH="auto">
            {toast.type === "loading" ? <Spinner size="sm" color="blue.solid" /> : <Toast.Indicator />}
            <Stack gap="0" flex="1" minWidth="0" maxWidth="100%">
              {toast.title && <Toast.Title textStyle="label/S/medium">{toast.title}</Toast.Title>}
              {toast.description && (
                <ScrollArea maxHeight="12rem" contentProps={{ paddingEnd: "1" }}>
                  <Toast.Description textStyle="paragraph/S/regular" whiteSpace="pre-wrap" wordBreak="break-word">
                    {toast.description}
                  </Toast.Description>
                </ScrollArea>
              )}
            </Stack>
            {toast.action && <Toast.ActionTrigger>{toast.action.label}</Toast.ActionTrigger>}
            <Toast.CloseTrigger />
          </Toast.Root>
        )}
      </ChakraToaster>
    </Portal>
  );
};
