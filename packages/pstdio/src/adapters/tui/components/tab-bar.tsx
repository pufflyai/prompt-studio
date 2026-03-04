import { Box, Text } from "ink";

interface TabBarProps {
  tabs: string[];
  activeIndex: number;
  width: number;
}

export function TabBar({ tabs, activeIndex, width }: TabBarProps) {
  return (
    <Box width={width}>
      <Text> </Text>
      {tabs.map((tab, i) => (
        <Text key={tab}>
          {i > 0 && <Text dimColor> │ </Text>}
          {i === activeIndex ? (
            <Text bold color="cyan">
              ▸ {tab}
            </Text>
          ) : (
            <Text dimColor>{tab}</Text>
          )}
        </Text>
      ))}
    </Box>
  );
}
