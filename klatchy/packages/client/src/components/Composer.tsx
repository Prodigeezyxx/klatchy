import React, { useState, useCallback } from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import { useStore } from "../store.js";
import { useClient } from "../hooks/useClient.js";
import { parseSlash, dispatchSlash } from "../slash.js";
import { HEX } from "../theme.js";

const HINT = "/pair /ask /diff /ai /share /rate /end";

export function Composer() {
  const [value, setValue] = useState("");
  const client = useClient();
  const activeSession = useStore((s) => s.activeSession);

  const handleSubmit = useCallback(
    (input: string) => {
      const trimmed = input.trim();
      if (!trimmed) return;

      const parsed = parseSlash(trimmed);
      if (parsed) {
        const msg = dispatchSlash(client, parsed);
        if (msg) {
          useStore.getState().appendLocal(msg, "system");
        }
        setValue("");
        return;
      }

      // Plain message
      if (activeSession) {
        useStore.getState().appendLocal(trimmed, "text");
        client.sendSessionMessage(activeSession.sessionId, trimmed, "text");
      } else {
        client.sendVibe({ message: trimmed });
      }
      setValue("");
    },
    [client, activeSession],
  );

  return (
    <Box flexDirection="column" marginX={1} marginBottom={1}>
      <Box>
        <Text dimColor>  {HINT}</Text>
      </Box>
      <Box
        borderStyle="round"
        borderColor={HEX.accent}
        paddingX={1}
      >
        <Text>▸ </Text>
        <TextInput
          value={value}
          onChange={setValue}
          onSubmit={handleSubmit}
          placeholder="send a vibe..."
        />
      </Box>
    </Box>
  );
}
