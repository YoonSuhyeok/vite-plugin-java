/**
 * Standalone vite.config.ts for Java (Spring MVC) integration.
 *
 * This configuration replicates the core functionality of vite-plugin-java
 * directly in vite.config.ts, without requiring the plugin as a dependency.
 *
 * What it does:
 *  - Sets base URL and output directory for Java backend integration
 *  - Generates a manifest file (.vite/manifest.json) for server-side asset resolution
 *  - Writes a "hot" file so the Java backend can detect the dev server
 *  - Replaces the origin placeholder with the real dev server URL at serve time
 *  - Cleans up the hot file when the dev server stops
 *  - Provides the default `@` → `/src` alias
 */
import process from 'node:process'
import fs from 'node:fs'
import path from 'node:path'
import type { AddressInfo } from 'node:net'
import { defineConfig, loadEnv } from 'vite'
import type { Plugin, ResolvedConfig } from 'vite'

// ---------------------------------------------------------------------------
// Configuration – adjust these values to match your project layout
// ---------------------------------------------------------------------------
const INPUT = 'src/main.ts' // entry point(s) — string | string[] | Record<string,string>
const PUBLIC_DIRECTORY = 'public' // public asset directory
const BUILD_DIRECTORY = 'build' // subdirectory inside the output for compiled assets
const OUTPUT_DIRECTORY = '../server/src/main/webapp/WEB-INF/dist' // where the bundle is written
const HOT_FILE = path.join(PUBLIC_DIRECTORY, 'hot') // set to `false` to disable
const JAVA_PROJECT_BASE = '../server' // path to Java project root (for version detection)

// ---------------------------------------------------------------------------
// Helper – detect Java version from Maven / Gradle build files
// ---------------------------------------------------------------------------
function javaVersion(projectRoot: string): string {
  try {
    const pomPath = path.join(projectRoot, 'pom.xml')
    if (fs.existsSync(pomPath)) {
      const pom = fs.readFileSync(pomPath, 'utf-8')
      return pom.match(/<java.version>(.*)<\/java.version>/)?.[1] ?? ''
    }

    const gradlePath = path.join(projectRoot, 'build.gradle')
    if (fs.existsSync(gradlePath)) {
      const gradle = fs.readFileSync(gradlePath, 'utf-8')
      return gradle.match(/sourceCompatibility\s*=\s*['"]?(\d+(\.\d+)?)['"]?/i)?.[1]
        ?? gradle.match(/sourceCompatibility\s*=\s*JavaVersion\.VERSION_(\d+(_\d+)?)/i)?.[1]?.replace('_', '.')
        ?? ''
    }

    const ktsPath = path.join(projectRoot, 'build.gradle.kts')
    if (fs.existsSync(ktsPath)) {
      const kts = fs.readFileSync(ktsPath, 'utf-8')
      return kts.match(/sourceCompatibility\s*=\s*JavaVersion\.VERSION_(\d+(_\d+)?)/i)?.[1]?.replace('_', '.')
        ?? kts.match(/java\.sourceCompatibility\s*=\s*JavaVersion\.VERSION_(\d+(_\d+)?)/i)?.[1]?.replace('_', '.')
        ?? ''
    }
  }
  catch { /* ignore */ }
  return ''
}

// ---------------------------------------------------------------------------
// Helper – resolve the dev server URL from the listening address
// ---------------------------------------------------------------------------
type DevServerUrl = `${'http' | 'https'}://${string}:${number}`

function resolveDevServerUrl(address: AddressInfo, config: ResolvedConfig): DevServerUrl {
  const configHmrProtocol = typeof config.server.hmr === 'object' ? config.server.hmr.protocol : null
  const clientProtocol = configHmrProtocol ? (configHmrProtocol === 'wss' ? 'https' : 'http') : null
  const serverProtocol = config.server.https ? 'https' : 'http'
  const protocol = clientProtocol ?? serverProtocol

  const configHmrHost = typeof config.server.hmr === 'object' ? config.server.hmr.host : null
  const configHost = typeof config.server.host === 'string' ? config.server.host : null
  const isV6 = address.family === 'IPv6' || (address.family as unknown) === 6
  const serverAddress = isV6 ? `[${address.address}]` : address.address
  const host = configHmrHost ?? configHost ?? serverAddress

  const configHmrClientPort = typeof config.server.hmr === 'object' ? config.server.hmr.clientPort : null
  const port = configHmrClientPort ?? address.port

  return `${protocol}://${host}:${port}`
}

// ---------------------------------------------------------------------------
// The inline plugin that replaces vite-plugin-java
// ---------------------------------------------------------------------------
function javaIntegrationPlugin(): Plugin {
  const PLACEHOLDER = '__java_vite_placeholder__'
  let viteDevServerUrl: DevServerUrl
  let resolvedConfig: ResolvedConfig
  let exitHandlersBound = false

  return {
    name: 'java-integration',
    enforce: 'post',

    config(_config, { command, mode }) {
      const env = loadEnv(mode, _config.envDir || process.cwd(), '')
      const assetUrl = env.ASSET_URL ?? '/'
      const base = command === 'build'
        ? `${assetUrl}${assetUrl.endsWith('/') ? '' : '/'}${BUILD_DIRECTORY}/`
        : ''

      return {
        base,
        publicDir: PUBLIC_DIRECTORY,
        build: {
          manifest: '.vite/manifest.json',
          outDir: OUTPUT_DIRECTORY,
          rollupOptions: { input: INPUT },
          assetsInlineLimit: 0,
        },
        server: {
          origin: PLACEHOLDER,
          host: 'localhost',
          port: env.VITE_PORT ? Number.parseInt(env.VITE_PORT) : 5173,
          strictPort: true,
        },
        resolve: {
          alias: { '@': '/src' },
        },
      }
    },

    configResolved(config) {
      resolvedConfig = config
    },

    transform(code) {
      if (resolvedConfig.command === 'serve') {
        return code.replace(new RegExp(PLACEHOLDER, 'g'), viteDevServerUrl)
      }
    },

    configureServer(server) {
      server.httpServer?.once('listening', () => {
        const address = server.httpServer?.address()
        if (address && typeof address === 'object') {
          viteDevServerUrl = resolveDevServerUrl(address, server.config)

          // Write the hot file so the Java backend knows the dev server is running
          if (HOT_FILE) {
            fs.writeFileSync(HOT_FILE, `${viteDevServerUrl}${server.config.base.replace(/\/$/, '')}`)
          }

          const version = javaVersion(JAVA_PROJECT_BASE)
          setTimeout(() => {
            server.config.logger.info(`\n  JAVA ${version}`)
          }, 100)
        }
      })

      if (!exitHandlersBound) {
        const clean = () => {
          if (HOT_FILE && fs.existsSync(HOT_FILE)) {
            fs.rmSync(HOT_FILE)
          }
        }
        process.on('exit', clean)
        process.on('SIGINT', () => process.exit())
        process.on('SIGTERM', () => process.exit())
        process.on('SIGHUP', () => process.exit())
        exitHandlersBound = true
      }
    },
  }
}

// ---------------------------------------------------------------------------
// Vite configuration
// ---------------------------------------------------------------------------
export default defineConfig({
  server: {
    open: true,
  },
  build: {
    emptyOutDir: true,
  },
  plugins: [javaIntegrationPlugin()],
})
