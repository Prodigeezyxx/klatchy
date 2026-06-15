import React, { useEffect, useState } from "react";
import { Box, useInput, Text } from "ink";
import { useStore } from "../store.js";
import { useClient } from "../hooks/useClient.js";
import { Banner } from "./Banner.js";
import { PoolPanel } from "./PoolPanel.js";
import { SessionPanel } from "./SessionPanel.js";
import { ContextPanel } from "./ContextPanel.js";
import { ToastHost } from "./ToastHost.js";
import { Footer } from "./Footer.js";

export function App() {
  const client = useClient();
  const me = useStore((s) => s.me);
  const incomingVibe = useStore((s) => s.incomingVibe);

  // Global key bindings
  useInput((input, key) => {
    if (input === "q" || (key.ctrl && input === "c")) {
      client.stop();
      process.exit(0);
    }
    if (input === "/") {
      // Focus the composer — we just trigger a global handler
      // In Ink, we can't directly focus a TextInput, but we can
      // call the onFocus handler. For P1, we just use the / key
      // as a hint to type.
    }
    if (input === "a" && incomingVibe) {
      client.acceptVibe(incomingVibe.vibeId);
    }
    if (input === "x" && incomingVibe) {
      client.declineVibe(incomingVibe.vibeId);
    }
  });

  return (
    <Box flexDirection="column" height="100%">
      <Banner handle={me?.handle} />

      <Box flexGrow={1} flexDirection="row">
        <Box width={36} borderStyle="single" borderColor="#2a2a36">
          <PoolPanel />
        </Box>
        <Box flexGrow={1}>
          <SessionPanel />
        </Box>
        <Box width={38} borderStyle="single" borderColor="#2a2a36">
          <ContextPanel />
        </Box>
      </Box>

      <Footer />
      <ToastHost />
    </Box>
  );
}
