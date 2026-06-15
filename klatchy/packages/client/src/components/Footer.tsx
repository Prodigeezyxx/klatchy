import React from "react";
import { Box, Text } from "ink";
import { HEX } from "../theme.js";

export function Footer() {
  return (
    <Box height={1} paddingX={1}>
      <Text dimColor>
        [/] send  [p] pool  [s] session  [a] accept  [x] dismiss  [q] quit
      </Text>
    </Box>
  );
}
