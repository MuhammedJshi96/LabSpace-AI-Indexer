import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  optimizeDeps: {
    include: ["react", "react-dom/client"],
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: ["terminal.local", "localhost", "127.0.0.1"],
    warmup: {
      clientFiles: ["./src/main.tsx"],
    },
  },
  plugins: [react()],
  build: {
    sourcemap: true,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (
            id.includes("three") ||
            id.includes("@react-three") ||
            id.includes("@monogrid/gainmap-js")
          )
            return "spatial";
          if (id.includes("konva")) return "plan";
          if (id.includes("qrcode")) return "exports";
          return "vendor";
        },
      },
    },
  },
});
