import React from "react";
import { Box, Text } from "ink";
import { useStore } from "../store.js";
import { DevCard } from "./DevCard.js";
import { HEX } from "../theme.js";

const ROOMS = [
  "# rust-helpdesk",
  "# late-night-debug",
  "# ship-it-friday",
  "# pair-up",
  "# ai-vibes",
];

export function PoolPanel() {
  const pool = useStore((s) => s.pool);
  const available = pool.filter((d) => d.status === "available").length;

  return (
    <Box flexDirection="column" height="100%">
      <Box>
        <Text color={HEX.accent}> ◆ </Text>
        <Text bold>pool</Text>
        <Text dimColor>  ·  </Text>
        <Text color={HEX.ok}>{available}</Text>
        <Text dimColor> available  ·  {pool.length} online</Text>
      </Box>

      <Box flexDirection="column" flexGrow={1}>
        {pool.length === 0 && (
          <Box paddingX={1} marginTop={1}>
            <Text dimColor>pool is quiet · 0 devs online</Text>
          </Box>
        )}
        {pool.slice(0, 15).map((dev) => (
          <DevCard key={dev.userId} dev={dev} />
        ))}
      </Box>

      <Box marginTop={1}>
        <Text color={HEX.accent2}> ◆ rooms</Text>
      </Box>
      {ROOMS.map((room) => (
        <Box key={room} paddingX={1}>
          <Text color={HEX.accent3}>{room}</Text>
        </Box>
      ))}

      <Box marginTop={1}>
        <Text color={HEX.accent3}> ◆ activity</Text>
        <Text dimColor>  · last 20 min</Text>
      </Box>
      <Box paddingX={1}>
        <Text dimColor>klatchy hum: 🎵 bedroom synths</Text>
      </Box>
    </Box>
  );
}
