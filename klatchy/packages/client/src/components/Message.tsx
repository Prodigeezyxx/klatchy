import React from "react";
import { Box, Text } from "ink";
import type { ChatLine } from "@klatchy/shared";
import { HEX } from "../theme.js";

interface Props {
  line: ChatLine;
  isMe?: boolean;
}

export function MessageView({ line, isMe }: Props) {
  if (line.kind === "system") {
    return (
      <Box justifyContent="center">
        <Text dimColor italic color={HEX.accent2}>
          ── {line.body} ──
        </Text>
      </Box>
    );
  }

  if (line.kind === "code" || line.kind === "diff") {
    return (
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={HEX.borderHi}
        paddingX={1}
        marginY={1}
      >
        <Text bold color={HEX.accent3}>
          {line.who}
        </Text>
        <Text>{line.body.slice(0, 500)}</Text>
      </Box>
    );
  }

  if (line.kind === "ai") {
    return (
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={HEX.accent4}
        paddingX={1}
        marginY={1}
      >
        <Text bold color={HEX.accent4}>
          ✨ ai · {line.who}
        </Text>
        <Text>{line.body.slice(0, 500)}</Text>
      </Box>
    );
  }

  // Plain text
  const nameColor = isMe ? HEX.accent3 : HEX.accent;
  const now = new Date(line.ts || Date.now()).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Box flexDirection="column">
      <Box>
        <Text bold color={nameColor}>
          @{line.who}
        </Text>
        <Text dimColor>  {now}</Text>
      </Box>
      <Text>{line.body}</Text>
    </Box>
  );
}
