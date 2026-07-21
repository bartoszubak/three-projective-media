import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

const demoRoot = fileURLToPath(new URL("./examples/basic", import.meta.url));
const demoOutput = fileURLToPath(new URL("./dist", import.meta.url));

export default defineConfig({
  root: demoRoot,
  base: "./",
  build: {
    outDir: demoOutput,
    emptyOutDir: true,
    sourcemap: false,
  },
});
