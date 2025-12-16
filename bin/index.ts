#!/usr/bin/env bun
import { spawnSync } from "node:child_process"
import { existsSync, rmSync } from "node:fs"
import { join } from "node:path"
import { parseArgs } from "node:util"
import { author, name, version } from "~/package.json"
import { build as bunBuild } from "bun"

type TsBunConfig = {
  entry?: string | string[]
  outdir?: string
  minify?: boolean
  target?: "bun" | "browser" | "node"
}

const helpMessage = `Version:
  ${name}@${version}

Usage:
  $ ${name} [entry] [options]

Options:
  -v, --version  Display version
  -h, --help     Display help message
  --watch        Watch mode

Author:
  ${author.name} <${author.email}> (${author.url})`

const loadConfig = async (): Promise<TsBunConfig | null> => {
  const configPath = join(process.cwd(), "tsbun.config.ts")
  if (existsSync(configPath)) {
    try {
      const configUrl = `file://${configPath}`
      const config = await import(configUrl)
      return config.default || config
    } catch (err: any) {
      console.warn(`Warning: Failed to load tsbun.config.ts: ${err.message}`)
      return null
    }
  }
  return null
}

const parse: typeof parseArgs = (config) => {
  try {
    return parseArgs(config)
  } catch (err: any) {
    throw new Error(`Error parsing arguments: ${err.message}`)
  }
}

const main = async () => {
  try {
    const args = process.argv.slice(2)

    const { positionals, values } = parse({
      allowPositionals: true,
      options: {
        help: { type: "boolean", short: "h" },
        version: { type: "boolean", short: "v" },
        watch: { type: "boolean" },
      },
      args,
    })

    if (values.version) {
      console.log(`${name}@${version}`)
      process.exit(0)
    }

    if (values.help) {
      console.log(helpMessage)
      process.exit(0)
    }

    // Load config if available
    const config = await loadConfig()
    if (config) {
      console.log("Using tsbun.config.ts...")
    }

    // Determine entry point
    let entry = positionals[0]
    if (!entry) {
      const defaultEntries = ["index.ts", "src/index.ts"]
      for (const e of defaultEntries) {
        if (existsSync(e)) {
          entry = e
          break
        }
      }
    }

    // Use config entry if no CLI entry provided
    if (!entry && config?.entry) {
      if (typeof config.entry === "string") {
        entry = config.entry
      } else if (Array.isArray(config.entry) && config.entry.length > 0) {
        entry = config.entry[0]
      }
    }

    if (!entry) {
      console.error(
        "Could not find entry point (index.ts or src/index.ts). Please specify one.",
      )
      process.exit(1)
    }

    const outdir = config?.outdir || "dist"
    const minify = config?.minify !== undefined ? config.minify : true
    const target = config?.target || "bun"

    console.log(`Building ${entry}...`)

    // Clean dist
    if (existsSync(outdir)) {
      rmSync(outdir, { recursive: true })
    }

    // Bundle with Bun
    const result = await bunBuild({
      entrypoints: [entry],
      outdir,
      target,
      minify,
    })

    if (!result.success) {
      console.error("Build failed!")
      for (const message of result.logs) {
        console.error(message)
      }
      process.exit(1)
    }

    console.log("JS Bundle created!")

    // Generate types with tsc
    console.log("Generating types...")

    const hasTsConfig = existsSync("tsconfig.json")
    const tscArgs = [
      "--declaration",
      "--emitDeclarationOnly",
      "--noEmit",
      "false",
      "--outDir",
      outdir,
    ]

    if (hasTsConfig) {
      console.log("Using tsconfig.json...")
      tscArgs.push("--project", "tsconfig.json")
    } else {
      // Default flags if no config
      tscArgs.push(
        "--esModuleInterop",
        "--skipLibCheck",
        "--moduleResolution",
        "bundler",
        "--target",
        "esnext",
        entry,
      )
    }

    const tsc = spawnSync("bun", ["x", "tsc", ...tscArgs], {
      stdio: "inherit",
    })

    if (tsc.status !== 0) {
      console.error("Type generation failed!")
      process.exit(1)
    }

    console.log("Build complete!")
    process.exit(0)
  } catch (err: any) {
    console.error(helpMessage)
    console.error(`\n${err.message}\n`)
    process.exit(1)
  }
}

main()
