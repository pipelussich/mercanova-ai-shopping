import { defineConfig } from "tsup";

/** Compila los scripts de migración y seed a JS autocontenido (con dependencias) para la imagen Docker. */
export default defineConfig({
  entry: { migrate: "scripts/migrate.ts", seed: "scripts/seed.ts" },
  outDir: "dist-scripts",
  format: ["cjs"],
  platform: "node",
  target: "node24",
  splitting: false,
  clean: true,
  noExternal: [/.*/],
});
