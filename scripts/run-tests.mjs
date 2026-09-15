import { spawnSync } from 'node:child_process'
import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildSync } from 'esbuild'

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const testsDirectory = join(projectRoot, 'tests')
const outputDirectory = mkdtempSync(join(tmpdir(), 'time-scheduler-tests-'))

try {
  const testFiles = readdirSync(testsDirectory)
    .filter(file => file.endsWith('.test.ts'))
    .map(file => join(testsDirectory, file))

  if (testFiles.length === 0) throw new Error('No test files found')

  const outputFiles = testFiles.map((testFile, index) => {
    const outputFile = join(outputDirectory, `${index}-${testFile.split(/[\\/]/).pop()}.mjs`)
    buildSync({
      entryPoints: [testFile],
      outfile: outputFile,
      bundle: true,
      platform: 'node',
      format: 'esm',
      target: 'node18',
      sourcemap: 'inline',
      banner: { js: "import { createRequire as __testCreateRequire } from 'node:module'; const require = __testCreateRequire(import.meta.url);" },
    })
    return outputFile
  })

  const result = spawnSync(process.execPath, ['--test', ...outputFiles], {
    cwd: projectRoot,
    stdio: 'inherit',
  })
  process.exitCode = result.status ?? 1
} finally {
  rmSync(outputDirectory, { recursive: true, force: true })
}
