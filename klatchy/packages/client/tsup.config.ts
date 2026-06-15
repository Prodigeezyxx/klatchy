import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/bin.tsx"],
  format: ["esm"],
  clean: true,
  sourcemap: true,
  outDir: "dist",
  banner: {
    js: "#!/usr/bin/env node",
  },
});
