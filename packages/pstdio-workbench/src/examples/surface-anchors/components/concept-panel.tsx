import { Box, Stack, Text } from "@chakra-ui/react";

interface ConceptRowProps {
  title: string;
  detail: string;
}

const ConceptRow = (props: ConceptRowProps) => {
  const { title, detail } = props;

  return (
    <Box>
      <Text textStyle="label/S/regular" color="fg">
        {title}
      </Text>
      <Text textStyle="paragraph/XS/regular" color="fg.muted">
        {detail}
      </Text>
    </Box>
  );
};

// A static legend for the surface model so the live behaviour on the right has context.
export const ConceptPanel = () => (
  <Stack gap="3" p="4" h="full" minH="0" overflowY="auto">
    <Text textStyle="label/S/regular" color="fg">
      Surface map
    </Text>
    <ConceptRow title="primary — main" detail="The active workspace. Drives breadcrumbs, history, lastResource." />
    <ConceptRow
      title="projection — left / right"
      detail="Reads the primary; never owns a resource. This legend + the panel on the right."
    />
    <ConceptRow title="secondary — derived" detail="Terminals. Re-scope (clear) when the primary changes." />
    <ConceptRow
      title="attached — detached"
      detail="Sessions. Persist across navigation, but disconnect when out of the new primary's scope."
    />
    <ConceptRow
      title="surface routing"
      detail="A kind declares its anchor (workspace→primary, terminal→secondary, session→attached)."
    />
  </Stack>
);
