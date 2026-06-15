import React from "react";
import { Box, Text } from "ink";

const GRADIENT = ["#ff6fae", "#e07ad0", "#c084ec", "#a78bfa", "#9ed1f0", "#7fe8d4", "#7fe8d4"];

interface Props {
  handle?: string;
}

export function Banner({ handle }: Props) {
  const word = "klatchy";
  return (
    <Box height={1} paddingX={1}>
      {word.split("").map((ch, i) => (
        <Text key={i} bold color={GRADIENT[i] ?? "#7fe8d4"}>
          {ch}
        </Text>
      ))}
      <Text dimColor>  ·  bring the vibes back to coding</Text>
      <Box flexGrow={1} />
      <Text dimColor>{handle ? `@${handle}` : ""}</Text>
    </Box>
  );
}
