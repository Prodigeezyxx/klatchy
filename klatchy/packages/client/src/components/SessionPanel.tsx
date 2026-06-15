import React, { useEffect, useRef } from "react";
import { Box, Text } from "ink";
import { useStore } from "../store.js";
import { MessageView } from "./Message.js";
import { Composer } from "./Composer.js";
import { HEX } from "../theme.js";

export function SessionPanel() {
  const activeSession = useStore((s) => s.activeSession);
  const messages = useStore((s) => s.messages);
  const me = useStore((s) => s.me);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-scroll to bottom on new messages
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  return (
    <Box flexDirection="column" height="100%" paddingX={1}>
      <Box>
        <Text color={HEX.accent}> ◆ session</Text>
        {activeSession ? (
          <>
            <Text dimColor>  ·  </Text>
            <Text color={HEX.accent}>@{activeSession.peer.handle}</Text>
            <Text dimColor>  ·  🔒  ·  </Text>
            <Text color={HEX.accent4}>⏱ {Math.floor(activeSession.durationSec / 60)}m</Text>
          </>
        ) : (
          <Text dimColor>  ·  idle</Text>
        )}
      </Box>

      <Box flexDirection="column" flexGrow={1} marginY={1}>
        {messages.length === 0 && (
          <Box>
            <Text dimColor>  no messages yet</Text>
          </Box>
        )}
        {messages.map((line, i) => (
          <MessageView
            key={i}
            line={line}
            isMe={me ? line.who === me.handle : false}
          />
        ))}
      </Box>

      <Composer />
    </Box>
  );
}
