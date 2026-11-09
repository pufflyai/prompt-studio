import { Button, HStack, Input, Stack, Text } from "@chakra-ui/react";
import { SimpleCard, SimpleCardBody } from "@pstdio/ui";
import { useState } from "react";

import { EditingError } from "../../editing-error";

/** Synthetic exploration only: no extension bridge, storage, project or network connections. */
export const MarmaladeEditingPreview = () => {
  const [title, setTitle] = useState("The Great Wave");
  const [accepted, setAccepted] = useState(title);
  const [error, setError] = useState("");
  const [held, setHeld] = useState(false);
  const [tool, setTool] = useState("Move");
  const commit = () => {
    if (!held) {
      setAccepted(title);
      setError("");
    }
  };
  return (
    <Stack gap="md" p="md" color="fg" bg="bg">
      <HStack gap="xs" flexWrap="wrap" aria-label="Preview controls">
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setHeld(!held);
            if (held) {
              setAccepted(title);
              setError("");
            }
          }}
        >
          {held ? "Release commands" : "Hold commands"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setError("The change could not be saved. Your draft is retained.");
            setHeld(false);
          }}
        >
          Fail command
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setTitle(accepted);
            setError("");
          }}
        >
          Cancel preview
        </Button>
      </HStack>
      <HStack align="stretch" gap="md" flexWrap="wrap">
        <SimpleCard flex="1" minW="0">
          <SimpleCardBody>
            <Stack gap="sm">
              <Text textStyle="label/M/medium">Canvas</Text>
              <Text textStyle="paragraph/L/regular">{title}</Text>
              <Text textStyle="label/XS" color="fg.muted">
                {tool}
              </Text>
              {error ? (
                <EditingError
                  error={error}
                  retry={() => {
                    setHeld(false);
                    setAccepted(title);
                    setError("");
                  }}
                />
              ) : null}
            </Stack>
          </SimpleCardBody>
        </SimpleCard>
        <SimpleCard flex="1" minW="0">
          <SimpleCardBody>
            <Stack gap="sm">
              <Text textStyle="label/M/medium">Layers</Text>
              <Text>{title}</Text>
              <HStack gap="xs">
                {["Move", "Hand"].map((value) => (
                  <Button
                    key={value}
                    size="xs"
                    variant={tool === value ? "solid" : "ghost"}
                    onClick={() => setTool(value)}
                  >
                    {value}
                  </Button>
                ))}
              </HStack>
            </Stack>
          </SimpleCardBody>
        </SimpleCard>
        <SimpleCard flex="1" minW="0">
          <SimpleCardBody>
            <Stack gap="sm">
              <Text textStyle="label/M/medium">Properties</Text>
              <Input
                aria-label="Layer text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                onBlur={commit}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setTitle(accepted);
                }}
              />
            </Stack>
          </SimpleCardBody>
        </SimpleCard>
      </HStack>
    </Stack>
  );
};
