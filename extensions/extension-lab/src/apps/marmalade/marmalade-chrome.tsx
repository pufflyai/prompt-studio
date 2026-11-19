import { Box, Button, HStack, Text } from "@chakra-ui/react";
import { ExampleIcon } from "../../icon";
import { BackToProject } from "../back-to-project";
import { marmaladeStore, useMarmalade } from "./marmalade-store";

export const MarmaladeNav = () => {
  const title = useMarmalade((projection) => projection.state.document.title);
  return (
    <HStack h="full" px="sm" gap="sm">
      <BackToProject />
      <ExampleIcon name="Image" />
      <Text textStyle="label/M/medium">Marmalade</Text>
      <Text textStyle="label/S/regular" color="fg.muted" truncate>
        {title}
      </Text>
      <Box flex="1" />
      <Button size="xs" variant="ghost" onClick={() => void marmaladeStore.dispatch({ type: "empty" })}>
        New
      </Button>
      <Button size="xs" variant="ghost" onClick={() => void marmaladeStore.dispatch({ type: "reset" })}>
        Restore sample
      </Button>
    </HStack>
  );
};
export const MarmaladeStatus = () => {
  const zoom = useMarmalade((projection) => Math.round(projection.state.zoom * 100));
  const width = useMarmalade((projection) => projection.state.document.width);
  const height = useMarmalade((projection) => projection.state.document.height);
  const layers = useMarmalade((projection) => projection.state.document.layers.length);
  const selected = useMarmalade((projection) => projection.state.selectedIds.length);
  return (
    <HStack h="full" px="sm" gap="md" aria-label="Marmalade status">
      <Text textStyle="label/XS">{zoom}%</Text>
      <Text textStyle="label/XS" color="fg.muted">
        {width} × {height} · RGB/8
      </Text>
      <Text textStyle="label/XS" color="fg.muted">
        {layers} layers · {selected} selected
      </Text>
    </HStack>
  );
};
