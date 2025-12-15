import { build } from "bun"

await build({
  entrypoints: ["bin/index.ts"],
  minify: true,
  outdir: "dist",
  packages: "bundle",
  target: "bun",
})
