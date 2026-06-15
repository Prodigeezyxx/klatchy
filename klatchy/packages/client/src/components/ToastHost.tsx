import React from "react";
import { Box, Text } from "ink";
import { useStore } from "../store.js";
import { useClient } from "../hooks/useClient.js";
import { HEX } from "../theme.js";

export function ToastHost() {
  const incoming = useStore((s) => s.incomingVibe);
  const client = useClient();

  if (!incoming) return null;

  return (
    <Box
      position="absolute"
      justifyContent="center"
      alignItems="center"
      width="100%"
      height="100%"
      paddingLeft={10}
      paddingRight={10}
    >
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={HEX.accent}
        padding={1}
      >
        <Text bold color={HEX.accent}>
          incoming vibe
        </Text>
        <Box>
          <Text bold>@{incoming.sender.handle}</Text>
          <Text dimColor>  ·  {incoming.match}%</Text>
        </Box>
        <Text dimColor>{incoming.message.slice(0, 100)}</Text>
        <Box marginTop={1}>
          <Text color={HEX.ok}>[a] accept  </Text>
          <Text color={HEX.err}>[x] dismiss</Text>
        </Box>
      </Box>
    </Box>
  );
}
