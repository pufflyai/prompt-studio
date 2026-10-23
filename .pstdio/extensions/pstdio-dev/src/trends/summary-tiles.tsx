import { Grid, Text } from "@chakra-ui/react";
import { SimpleCard, SimpleCardBody } from "@pstdio/ui";
import type { versionSummary } from "./trend-summary";

interface SummaryTilesProps {
  version: string;
  summary: ReturnType<typeof versionSummary>;
}

interface TileProps {
  label: string;
  value: string | number;
}

const Tile = (props: TileProps) => {
  const { label, value } = props;
  return (
    <SimpleCard>
      <SimpleCardBody display="flex" flexDirection="column" gap="2xs">
        <Text textStyle="label/S/regular" color="fg.muted">
          {label}
        </Text>
        <Text textStyle="heading/XL">{value}</Text>
      </SimpleCardBody>
    </SimpleCard>
  );
};

export const SummaryTiles = (props: SummaryTilesProps) => {
  const { version, summary } = props;
  return (
    <Grid templateColumns="repeat(auto-fit, minmax(14rem, 1fr))" gap="md">
      <Tile label={`Improved in ${version}`} value={summary.improved} />
      <Tile label={`Regressed in ${version}`} value={summary.regressed} />
      <Tile label={`Over budget in ${version}`} value={summary.overBudget} />
    </Grid>
  );
};
