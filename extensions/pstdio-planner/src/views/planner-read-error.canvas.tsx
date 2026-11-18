import { Button, Stack, Text } from "@chakra-ui/react";
import { useState } from "react";
import { PlannerReadError } from "./planner-read-error";

export default { title: "Extensions/Planner/Read recovery" };
export const Recovery = () => {
  const [error, setError] = useState<Error | undefined>(() => new Error("Planner could not refresh this project."));
  return (
    <Stack position="relative" p="md" gap="md">
      <PlannerReadError error={error} retry={() => setError(undefined)} />
      <Text>Loaded timeline and selection remain available.</Text>
      <Button onClick={() => setError(new Error("Planner could not refresh this project."))}>
        Simulate failed refresh
      </Button>
    </Stack>
  );
};
