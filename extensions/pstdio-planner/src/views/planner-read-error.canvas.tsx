import { Button, Stack, Text } from "@chakra-ui/react";
import { useState } from "react";
import { PlannerReadError } from "./planner-read-error";

export default { title: "Extensions/Planner/Read recovery" };
export const Recovery = () => {
  const [failed, setFailed] = useState(true);
  return (
    <Stack p="md" gap="md">
      <PlannerReadError
        error={failed ? new Error("Planner could not refresh this project.") : undefined}
        retry={() => setFailed(false)}
      />
      <Text>Loaded timeline and selection remain available.</Text>
      <Button onClick={() => setFailed(true)}>Simulate failed refresh</Button>
    </Stack>
  );
};
