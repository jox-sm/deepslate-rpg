import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

const alias = {
  "@": path.resolve(__dirname, "."),
};

export default defineConfig({
  plugins: [react()],
  resolve: { alias },
  test: {
    globals: true,
    projects: [
      {
        resolve: { alias },
        test: {
          name: "web",
          environment: "jsdom",
          setupFiles: ["./vitest.setup.ts"],
          include: [
            "lib/**/*.test.{ts,tsx}",
            "hooks/**/*.test.{ts,tsx}",
            "utilities/**/*.test.{ts,tsx}",
            "stores/**/*.test.{ts,tsx}",
            "components/**/*.test.{ts,tsx}",
            "ui/**/*.test.{ts,tsx}",
          ],
        },
      },
      {
        resolve: { alias },
        test: {
          name: "api",
          environment: "node",
          include: ["app/api/**/*.test.{ts,tsx}"],
        },
      },
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
    },
  },
});
