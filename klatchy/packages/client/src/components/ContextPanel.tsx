import React from "react";
import { Box, Text } from "ink";
import { useStore } from "../store.js";
import { gitBranch, gitCounts } from "../git.js";
import { tierFor } from "@klatchy/shared";
import { HEX } from "../theme.js";

export function ContextPanel() {
  const me = useStore((s) => s.me);
  const karma = me?.karma ?? 0;
  const tier = me ? tierFor(karma) : "—";
  const branch = gitBranch();
  const { changed, staged } = gitCounts();

  return (
    <Box flexDirection="column" height="100%" paddingX={1}>
      <Box>
        <Text color={HEX.accent2}> ◆ context</Text>
      </Box>

      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor={HEX.border}
        paddingX={1}
        marginY={1}
      >
        <Text color={HEX.accent2}>  ⎇  </Text>
        <Text bold>{branch}</Text>
        <Box>
          <Text color={HEX.err}>●</Text>
          <Text dimColor> {changed} changed  </Text>
          <Text color={HEX.ok}>●</Text>
          <Text dimColor> {staged} staged</Text>
        </Box>
      </Box>

      <Box marginTop={1}>
        <Text color={HEX.accent4}> ◆ your vibe</Text>
      </Box>
      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor={HEX.border}
        paddingX={1}
        marginY={1}
      >
        <Box>
          <Text color={HEX.accent2}>♦ </Text>
          <Text bold>{karma.toLocaleString()}</Text>
          <Text dimColor> karma</Text>
        </Box>
        <Text italic color={HEX.accent}>
          {"  "}
          {tier}
        </Text>
        <Text dimColor>
          {karma < 100
            ? `  ${100 - karma} to regular`
            : karma < 1000
              ? `  ${1000 - karma} to sensei`
              : karma < 5000
                ? `  ${5000 - karma} to legend ✦`
                : "  legend ✦"}
        </Text>
      </Box>
    </Box>
  );
}
