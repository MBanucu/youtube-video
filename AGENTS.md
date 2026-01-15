# AGENTS.md - YouTube Video Automation Project

This file contains essential information for AI coding agents working on this YouTube video automation project. It includes build/lint/test commands, code style guidelines, and development practices.

## Project Overview

This is a TypeScript project using Bun runtime for automating YouTube video processing tasks including:
- Video splitting and concatenation
- Audio extraction and transcription
- AI-powered description generation
- Batch processing workflows

## Build/Lint/Test Commands

### Dependencies & Setup
```bash
bun install                    # Install all dependencies
```

### Code Quality Checks
```bash
bun run check                  # Run linting, formatting, and fix issues (Biome)
bun run lint                   # Lint code only (Biome)
bun run fmt                    # Format code only (Biome)
bun tsc --noEmit              # TypeScript type checking
bun run knip                  # Check for unused dependencies/code
```

### Testing
```bash
bun test                       # Run all tests concurrently
bun test <file>               # Run a specific test file
bun test --concurrent <file>  # Run specific test with concurrent execution
```

**Test Discovery**: Tests are automatically discovered using patterns `**/*.test.{js,mjs,cjs,ts,mts,cts,jsx,tsx}` and `**/*.spec.{js,mjs,cjs,ts,mts,cts,jsx,tsx}`. Each test file runs in parallel in CI.

**Running Single Tests**: Use `bun test <path/to/testfile.test.ts>` to run individual test files. For performance-heavy tests like transcription, they are conditionally skipped locally (run only in CI) using environment checks.

**Conditional Test Execution**: Use `runHeavyTest` from `test/utils.ts` for tests that should run concurrently in CI but skip locally:
```typescript
import { runHeavyTest } from './utils'

runHeavyTest('test name', async () => { ... }, { timeout: 300000 })
```

### CI Pipeline
The project uses GitHub Actions with:
- Automated test matrix (one job per test file)
- Linting and type checking
- Dependency caching
- FFmpeg, Python, and OpenCode CLI setup

## Code Style Guidelines

### TypeScript Configuration
- **Target**: ESNext
- **Module**: Preserve (Bun-compatible)
- **Strict Mode**: Enabled
- **Path Aliases**: `@/*` → `src/*`, `@test/*` → `test/*`

### Formatting (Biome)
- **Indentation**: 2 spaces
- **Quotes**: Single quotes (`'`)
- **Semicolons**: As needed (ASI-compliant)
- **Line Width**: Default (120 characters)
- **Import Ordering**: Node.js built-ins first, then project modules

### Import/Export Patterns
```typescript
// Node.js built-ins (use 'node:' prefix for Bun compatibility)
import { join } from 'node:path'
import { existsSync, mkdirSync } from 'node:fs'

// Bun runtime APIs
import { spawn } from 'bun'

// Project modules with path aliases
import { someFunction } from '@/utils'
import { testHelper } from '@test/helpers'

// Third-party libraries
import yargs from 'yargs'

// Object exports preferred for related functionality
export const config = {
  apiUrl: 'https://api.example.com',
  timeout: 5000,
}
```

### Naming Conventions
- **Files**: kebab-case (`video-processor.ts`, `extract-wav.ts`)
- **Functions/Variables**: camelCase (`extractWavFromVideo`, `outputPath`)
- **Types/Interfaces**: PascalCase (`VideoConfig`, `ProcessingOptions`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_RETRIES = 3`)
- **Classes**: PascalCase with descriptive names

### Error Handling
```typescript
// Throw descriptive errors
if (Number.isNaN(duration)) {
  throw new Error(`Unable to get duration for ${file}`)
}

// Use try/catch for async operations
try {
  const result = await processVideo(input)
  return result
} catch (error) {
  throw new Error(`Video processing failed: ${error.message}`)
}
```

### Async/Await Patterns
```typescript
// Always use async/await over Promise chains
export async function processVideo(file: string): Promise<VideoResult> {
  const duration = await ffprobeDuration(file)
  const output = await extractAudio(file)
  return { duration, output }
}
```

### Function Documentation
```typescript
/**
 * Extract WAV audio from video file using FFmpeg.
 * @param inputVideo - Path to input video file
 * @param outputWav - Path for output WAV file
 * @returns true if extraction successful
 */
export function extractWavFromVideo(inputVideo: string, outputWav: string): boolean {
  // implementation
}
```

### Testing Patterns
```typescript
import { expect, mock, test } from 'bun:test'
import { join } from 'node:path'

// Conditional test execution for performance-heavy tests
const runHeavyTest = process.env['CI'] ? test.concurrent : test.skip

runHeavyTest('functionName - describes what it does', async () => {
  // Arrange
  const input = join('testdata', 'sample.MTS')
  const output = join('tmp', 'output.wav')

  // Act
  const result = await someFunction(input, output)

  // Assert
  expect(result).toBe(true)
  expect(existsSync(output)).toBe(true)

  // Cleanup
  rmSync(output, { force: true })
}, { timeout: 60000 }) // Set timeouts for long operations
```

**Test Organization**:
- Use `runHeavyTest` for performance-heavy tests (imports from `test/utils.ts`)
- Place test data in `testdata/` directory
- Use temporary directories for outputs
- Always clean up test artifacts
- Set appropriate timeouts for async operations
- Mock external APIs and file operations appropriately

### File Structure
```
src/           # Main source code
  utils.ts     # Shared utilities
  paths.ts     # Path configurations
  *-wav.ts     # Audio processing
  *-mts.ts     # Video processing

test/          # Test files
  *.test.ts    # Unit tests
  utils.ts     # Test utilities (runHeavyTest)

testdata/      # Test data files
  *.MTS        # Video test files
  *.txt        # Text test files

.github/       # GitHub Actions workflows
  workflows/   # CI/CD pipelines

node_modules/  # Dependencies (managed by Bun)
```

### Type Safety Best Practices
- Use strict TypeScript settings
- Avoid `any` types - use proper type annotations
- Leverage union types for multiple possible values
- Use interface/type aliases for complex objects
- Enable `noImplicitAny` and related strict checks
- Prefer readonly properties for immutable data

### Performance Considerations
- Use `Bun.spawn()` for external processes (FFmpeg, Python scripts)
- Leverage `Bun.file()` and `Bun.write()` for optimized file I/O
- Handle large video files with streaming
- Set reasonable timeouts for long operations
- Use concurrent test execution for faster CI

### Security Practices
- Validate file paths and inputs
- Use secure temporary file creation (`mkdtempSync`)
- Avoid shell injection in command execution
- Sanitize user inputs for file operations
- Store sensitive data securely (OAuth tokens, etc.)

### Commit Message Style
Follow conventional commits:
- `feat: add new video splitting feature`
- `fix: resolve audio extraction bug`
- `test: add tests for concat functionality`
- `refactor: improve error handling in utils`

### Development Workflow
1. **Before committing**: Run `bun run check` to ensure code quality
2. **Test locally**: Run relevant tests with `bun test <file>` (heavy tests auto-skip)
3. **Type check**: Run `bun tsc --noEmit` for type safety
4. **Unused code**: Run `bun run knip` to check for dead code
5. **Commit**: Use conventional commit format with detailed body

### Git Hooks (Lefthook)
- **Pre-commit**: Biome formatting, TypeScript checking, knip, fast tests
- **Pre-push**: Full linting, full TypeScript, knip, full tests
- **Commit-msg**: Commitlint for conventional commits

### Configurable Options
The `batchUploadToYoutube` function accepts configurable options:
```typescript
interface BatchUploadOptions {
  credentialsPath: string
  videosDir?: string
  descriptionsDir?: string
  tokenPath?: string      // Custom token file location
  categoryId?: string     // YouTube category ID
  privacyStatus?: string  // 'public', 'private', 'unlisted'
  maxRetries?: number     // Maximum number of upload retries (default: 3)
  retryDelay?: number     // Base delay in ms for exponential backoff (default: 1000)
}
```

**Retry Logic**: Uploads use exponential backoff retry on failure to handle network issues. The delay increases as 2^attempt * retryDelay ms.

### External Dependencies
- **FFmpeg**: Video/audio processing
- **Python + faster-whisper**: AI transcription
- **OpenCode CLI**: AI description generation
- **Bun runtime**: JavaScript/TypeScript execution
- **Google APIs**: YouTube integration

### Common Patterns in This Codebase
- Functional programming style with pure functions
- Configuration objects for complex operations (BatchUploadOptions)
- Path manipulation using `node:path` utilities
- Error-first callbacks converted to async/await
- JSDoc for public API documentation
- Consistent use of `Promise<T>` return types
- Conditional test execution based on environment
- Use of Bun's optimized APIs (Bun.file, Bun.write, Bun.spawn)

### AI Assistant Integration
- **Cursor Rules**: No specific Cursor rules configured (.cursor/rules/ or .cursorrules not found)
- **GitHub Copilot Instructions**: No custom Copilot instructions (.github/copilot-instructions.md not found)
- Use this AGENTS.md as the primary guide for code style and development practices
- Follow the established patterns for new contributions to maintain consistency