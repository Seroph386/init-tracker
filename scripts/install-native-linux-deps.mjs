import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const rootDir = dirname(fileURLToPath(new URL('../package.json', import.meta.url)))
const lockfileContents = readFileSync(join(rootDir, 'pnpm-lock.yaml'), 'utf8')

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function readVersionFromLockfile(packageName) {
  const matcher = new RegExp(`^  '?${escapeRegex(packageName)}@([^:'\n]+)'?:$`, 'gm')
  const versions = [...lockfileContents.matchAll(matcher)].map((match) => match[1])
  const uniqueVersions = [...new Set(versions)]

  if (uniqueVersions.length !== 1) {
    throw new Error(`Expected exactly one locked version for ${packageName}, found: ${uniqueVersions.join(', ') || 'none'}`)
  }

  return uniqueVersions[0]
}

function isInstalled(packageName) {
  try {
    require.resolve(`${packageName}/package.json`, {
      paths: [rootDir],
    })
    return true
  } catch {
    return false
  }
}

if (process.platform !== 'linux' || process.arch !== 'x64') {
  console.log('Skipping native Linux dependency hydration on this platform.')
  process.exit(0)
}

const packages = [
  { native: '@rollup/rollup-linux-x64-gnu', source: 'rollup' },
  { native: '@esbuild/linux-x64', source: 'esbuild' },
  { native: 'lightningcss-linux-x64-gnu', source: 'lightningcss' },
  { native: '@tailwindcss/oxide-linux-x64-gnu', source: '@tailwindcss/oxide' },
]
  .filter(({ native }) => !isInstalled(native))
  .map(({ native, source }) => `${native}@${readVersionFromLockfile(source)}`)

if (packages.length === 0) {
  console.log('All required Linux native dependencies are already installed.')
  process.exit(0)
}

const command = ['add', '-D', '--no-save', ...packages]

if (process.env.NATIVE_DEPS_DRY_RUN === '1') {
  console.log(`pnpm ${command.join(' ')}`)
  process.exit(0)
}

const result = spawnSync('pnpm', command, {
  cwd: rootDir,
  stdio: 'inherit',
})

process.exit(result.status ?? 1)
