import React from "react";
import { Box, Text } from "ink";
import type { DevPublic } from "@klatchy/shared";
import { HEX } from "../theme.js";

interface Props {
  dev: DevPublic;
  focused?: boolean;
}

export function DevCard({ dev, focused }: Props) {
  const dotColor =
    dev.status === "available"
      ? HEX.ok
      : dev.status === "busy"
        ? HEX.warn
        : dev.status === "deep"
          ? HEX.deep
          : HEX.textFaint;
  const dot = dev.status === "deep" ? "◐" : "●";

  return (
    <Box
      flexDirection="column"
      paddingX={1}
      borderStyle={focused ? "bold" : undefined}
      borderColor={focused ? HEX.accent : undefined}
    >
      <Box>
        <Text color={dotColor}>{dot}</Text>
        <Text> </Text>
        <Text bold>@{dev.handle}</Text>
        <Text> </Text>
        <Text color={HEX.accent}>{dev.match}%</Text>
      </Box>
      <Box>
        <Text dimColor>
          {"  "}
          {(dev.stack ?? []).slice(0, 3).join(" · ") || "—"}
        </Text>
      </Box>
      <Box>
        <Text dimColor>  ♦ </Text>
        <Text color={HEX.accent2}>{dev.karma.toLocaleString()}</Text>
        {dev.streak > 0 && (
          <Text color={HEX.accent4}>  🔥{dev.streak}d</Text>
        )}
      </Box>
    </Box>
  );
}
