import { Button, Flex, HStack } from "@chakra-ui/react";
import { ScopedDialog as Dialog } from "@pstdio/ui";
import type { RegisteredControlsRendererContribution } from "../../../core";

export interface ControlsFooterProps {
  visible?: boolean;
  contribution: RegisteredControlsRendererContribution;
  pending: boolean;
  submit: (reset: boolean) => Promise<void>;
  dialog?: boolean;
  onClose?: () => void;
}
export const ControlsFooter = (props: ControlsFooterProps) => {
  if (props.dialog)
    return (
      <Dialog.Footer>
        <HStack gap="2">
          <Button size="sm" variant="ghost" disabled={props.pending} onClick={props.onClose}>
            Cancel
          </Button>
          {props.visible && props.contribution.apply ? (
            <Button size="sm" variant="primary" loading={props.pending} onClick={() => void props.submit(false)}>
              Apply
            </Button>
          ) : null}
        </HStack>
      </Dialog.Footer>
    );
  return props.visible ? (
    <Flex borderTopWidth="1px" borderColor="border.muted" pl="sm" pr="4xl" py="xs" gap="xs" justifyContent="flex-end">
      {props.contribution.reset || props.contribution.apply ? (
        <Button size="xs" variant="ghost" disabled={props.pending} onClick={() => void props.submit(true)}>
          Reset
        </Button>
      ) : null}
      {props.contribution.apply ? (
        <Button size="xs" variant="subtle" disabled={props.pending} onClick={() => void props.submit(false)}>
          Apply
        </Button>
      ) : null}
    </Flex>
  ) : null;
};
