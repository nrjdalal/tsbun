#!/usr/bin/env bun
import { rmSync } from "node:fs"
import { join, relative } from "node:path"
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

const formatSize = (bytes: number) => {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

const loadConfig = async (): Promise<{
  config: TsBunConfig | null
  path: string | null
}> => {
  const configPath = join(process.cwd(), "tsbun.config.ts")
  if (await Bun.file(configPath).exists()) {
    try {
      const configUrl = `file://${configPath}`
      const config = await import(configUrl)
      return { config: config.default || config, path: configPath }
    } catch (err: any) {
      console.warn(`Warning: Failed to load tsbun.config.ts: ${err.message}`)
      return { config: null, path: null }
    }
  }
  return { config: null, path: null }
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
    const startTime = performance.now()

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
    const { config, path: configPath } = await loadConfig()

    // Determine entry point
    let entry = positionals[0]
    if (!entry) {
      const defaultEntries = ["index.ts", "src/index.ts"]
      for (const e of defaultEntries) {
        if (await Bun.file(e).exists()) {
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

    // Start logs
    console.log(`CLI Building entry: {"${entry}":"${entry}"}`)
    const hasTsConfig = await Bun.file("tsconfig.json").exists()
    if (hasTsConfig) {
      console.log(`CLI Using tsconfig: tsconfig.json`)
    }
    console.log(`CLI ${name} v${version}`)
    if (configPath) {
      console.log(`CLI Using tsbun config: ${configPath}`)
    }
    console.log(`CLI Target: ${target}`)
    console.log(`CLI Cleaning output folder`)

    // Clean dist
    rmSync(outdir, { recursive: true, force: true })

    console.log(`ESM Build start`)

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

    // Log outputs
    for (const output of result.outputs) {
      console.log(
        `ESM ${relative(process.cwd(), output.path)} ${formatSize(output.size)}`,
      )
    }

    const duration = Math.round(performance.now() - startTime)
    console.log(`ESM ⚡️ Build success in ${duration}ms`)

    const tscArgs = [
      "--declaration",
      "--emitDeclarationOnly",
      "--noEmit",
      "false",
      "--outDir",
      outdir,
    ]

    if (hasTsConfig) {
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

    const tsc = Bun.spawnSync(["bun", "x", "tsc", ...tscArgs], {
      stdout: "inherit",
      stderr: "inherit",
      stdin: "inherit",
    })

    if (tsc.exitCode !== 0) {
      console.error("Type generation failed!")
      process.exit(1)
    }

    process.exit(0)
  } catch (err: any) {
    console.error(helpMessage)
    console.error(`\n${err.message}\n`)
    process.exit(1)
  }
}

main()
