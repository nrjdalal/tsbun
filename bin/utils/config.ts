import { join } from "node:path"

export type TsBunConfig = {
  entry?: string | string[]
  outdir?: string
  minify?: boolean
  target?: "bun" | "browser" | "node"
}

export const loadConfig = async (): Promise<{
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
