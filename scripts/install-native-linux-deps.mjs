import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = dirname(fileURLToPath(new URL('../package.json', import.meta.url)))
const pnpmDir = join(rootDir, 'node_modules', '.pnpm')

function readVersionFromPnpmStore(prefix, packagePath) {
  const entry = readdirSync(pnpmDir).find((name) => name.startsWith(prefix))
  if (!entry) {
    throw new Error(`Unable to find ${prefix} in ${pnpmDir}`)
  }

  const packageJsonPath = join(pnpmDir, entry, 'node_modules', ...packagePath, 'package.json')
  return JSON.parse(readFileSync(packageJsonPath, 'utf8')).version
}

if (process.platform !== 'linux' || process.arch !== 'x64') {
  console.log('Skipping native Linux dependency hydration on this platform.')
  process.exit(0)
}

const packages = [
  `@rollup/rollup-linux-x64-gnu@${readVersionFromPnpmStore('rollup@', ['rollup'])}`,
  `@esbuild/linux-x64@${readVersionFromPnpmStore('esbuild@', ['esbuild'])}`,
  `lightningcss-linux-x64-gnu@${readVersionFromPnpmStore('lightningcss@', ['lightningcss'])}`,
  `@tailwindcss/oxide-linux-x64-gnu@${readVersionFromPnpmStore('@tailwindcss+oxide@', ['@tailwindcss', 'oxide'])}`,
]

const missingPackages = packages.filter((pkg) => {
  const packageName = pkg.replace(/@[^@]+$/, '').replace('/', '+')
  return !existsSync(join(pnpmDir, `${packageName}@${pkg.split('@').at(-1)}`))
})

if (missingPackages.length === 0) {
  console.log('Linux native dependencies are already present.')
  process.exit(0)
}

const command = ['install', '--force', '--prefer-offline']

if (process.env.NATIVE_DEPS_DRY_RUN === '1') {
  console.log(`pnpm ${command.join(' ')}`)
  console.log(`Missing native packages: ${missingPackages.join(', ')}`)
  process.exit(0)
}

console.log(`Missing native packages detected: ${missingPackages.join(', ')}`)
console.log(`pnpm ${command.join(' ')}`)

const result = spawnSync('pnpm', command, {
  cwd: rootDir,
  stdio: 'inherit',
})

process.exit(result.status ?? 1)
