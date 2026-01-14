// discover-tests.ts
const patterns = [
  '**/*.test.js',
  '**/*.test.mjs',
  '**/*.test.cjs',
  '**/*.test.ts',
  '**/*.test.mts',
  '**/*.test.cts',
  '**/*.test.jsx',
  '**/*.test.tsx',
  '**/*.spec.js',
  '**/*.spec.mjs',
  '**/*.spec.cjs',
  '**/*.spec.ts',
  '**/*.spec.mts',
  '**/*.spec.cts',
  '**/*.spec.jsx',
  '**/*.spec.tsx',
]

const ignoredDirs = ['/node_modules/', '/.git/'] // Approximate Bun's defaults (ignores common dirs like these)

const files = new Set<string>()

for (const pattern of patterns) {
  const glob = new Bun.Glob(pattern)
  for (const file of glob.scanSync({ cwd: '.' })) {
    if (!ignoredDirs.some((dir) => file.includes(dir))) {
      files.add(file)
    }
  }
}

const sortedFiles = Array.from(files).sort()
console.log(JSON.stringify({ 'test-file': sortedFiles }))
