# AGENTS.md - YouTube Video Automation Project

This file contains essential information for AI coding agents working on this YouTube video automation project. It includes build/lint/test commands, code style guidelines, and development practices.

## Project Overview

This is a TypeScript project using Bun runtime for automating YouTube video processing tasks including:
- Video splitting and concatenation
- Audio extraction and transcription
- AI-powered description generation
- Batch processing workflows

## Project Architecture Overview

### High-Level Architecture
The project follows a modular, pipeline-based architecture designed for automated video processing workflows. It consists of several interconnected components that form a complete video-to-YouTube pipeline:

```
Raw Video Files → Video Processing → Audio Processing → AI Processing → YouTube Upload
     ↓              ↓                ↓              ↓              ↓
   .MTS files    Splitting/        WAV extraction   Transcription   Batch upload
                  Concatenation                      Description     with retry
                                                   generation       logic
```

### Key Components

1. **Video Processing Layer** (`*-mts.ts` files)
   - Handles video file operations using FFmpeg
   - Supports precise splitting by duration/timestamps
   - Concatenation of multiple video segments
   - Duration calculation and validation

2. **Audio Processing Layer** (`*-wav.ts` files)
   - Extracts audio tracks from video files
   - Converts to WAV format for transcription
   - Manages temporary file cleanup

3. **AI Processing Layer** (External integrations)
   - Transcription using faster-whisper (Python)
   - Description generation using OpenCode CLI
   - Batch processing with conditional execution

4. **YouTube Integration Layer** (`batchUploadToYoutube.ts`)
   - OAuth2 authentication with token persistence
   - Batch upload with configurable retry logic
   - Metadata management (titles, descriptions, privacy settings)
   - Exponential backoff for network resilience

5. **YouTube Upload Verification Layer** (`verifyYoutubeUpload.ts`)
   - Post-upload metadata validation using YouTube API polling
   - Configurable retry attempts with exponential backoff
   - Comprehensive error handling and logging
   - Validates title, description, category, and privacy status

6. **Configuration & Types Layer** (`types.ts`, `paths.ts`)
   - Strongly typed configuration objects
   - Path management with environment flexibility
   - Interface definitions for all major operations

### Design Principles
- **Functional Programming**: Pure functions with minimal side effects
- **Configuration-Driven**: Complex operations parameterized via options objects
- **Error Resilience**: Comprehensive error handling with descriptive messages
- **Performance Awareness**: Streaming for large files, conditional heavy operations
- **Testability**: Modular design enabling comprehensive unit testing

## Important Files, Directories, and Modules

### Core Source Files (`src/`)

- **`batchUploadToYoutube.ts`**: Main YouTube uploader class with OAuth2 authentication, batch processing, and retry logic. The primary entry point for YouTube operations.
- **`verifyYoutubeUpload.ts`**: Post-upload verification system that polls YouTube API to validate uploaded video metadata
- **`types.ts`**: Contains all TypeScript interfaces and types used across the project, including `BatchUploadOptions`, `ClientCredentials`, and YouTube API response types.
- **`paths.ts`**: Centralizes path configurations and default directories for videos, descriptions, and outputs.
- **`utils.ts`**: Shared utility functions for common operations like file validation, duration parsing, and error formatting.

### Test Infrastructure (`test/`)

- **`batchUploadToYoutube.test.ts`**: Comprehensive tests for YouTube upload functionality, including auth, batch processing, and retry scenarios.
- **`batchGenerateDescription.test.ts`**: Tests for AI-powered description generation (runs only in CI due to external dependencies).
- **`batchTranscribe.test.ts`**: Tests for audio transcription workflows.
- **`runTranscribe.test.ts`**: Individual transcription test cases.
- **`utils.ts`**: Test utilities including `runHeavyTest` for conditional execution based on CI environment.
- **`fakeGoogleServer.ts`**: Mock YouTube API server for testing with realistic API simulation

### Test Data and Assets (`testdata/`)

- **`.MTS` files**: Sample video files for testing video processing operations.
- **`.txt` files**: Expected output files for transcription and description tests.

### Configuration Files

- **`tsconfig.json`**: TypeScript configuration with Bun-compatible settings, path aliases (`@/*`, `@test/*`), and strict mode enabled.
- **`biome.json`**: Biome configuration for linting and formatting with 2-space indentation, single quotes, and ASI-compliant semicolons.
- **`lefthook.yml`**: Git hooks configuration for pre-commit and pre-push quality checks.
- **`package.json`**: Project metadata, scripts, and dependencies managed by Bun.

### CI/CD Infrastructure (`.github/`)

- **`workflows/test.yml`**: GitHub Actions workflow with matrix testing, conditional concurrency, and setup for FFmpeg/Python dependencies.

### External Dependencies and Tools

- **FFmpeg**: Used for video splitting, concatenation, and audio extraction.
- **Python + faster-whisper**: For AI-powered audio transcription.
- **OpenCode CLI**: For generating video descriptions using AI.
- **Bun runtime**: JavaScript/TypeScript execution.
- **Google APIs**: YouTube Data API v3 for video uploads and metadata management.

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

runHeavyTest('functionName - describes what it does', async () => { ... }, { timeout: 300000 })
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

#### Advanced Testing Patterns
```typescript
// Example: Testing async operations with proper cleanup
test('video processing workflow', async () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'test-'))
  const inputFile = join(tempDir, 'input.MTS')
  const outputFile = join(tempDir, 'output.wav')

  try {
    // Setup test data
    writeFileSync(inputFile, 'fake video data')

    // Act
    const result = await processVideo(inputFile, outputFile)

    // Assert
    expect(result).toBe(true)
    expect(existsSync(outputFile)).toBe(true)

    // Verify file contents or metadata
    const stats = statSync(outputFile)
    expect(stats.size).toBeGreaterThan(0)
  } finally {
    // Always cleanup, even on failure
    rmSync(tempDir, { recursive: true, force: true })
  }
}, { timeout: 30000 })

// Example: Mocking external processes
test('FFmpeg integration', async () => {
  const spawnMock = mock(() => ({
    exited: Promise.resolve(0),
    stdout: readableStreamFrom('success'),
    stderr: readableStreamFrom('')
  }))

  // Mock Bun.spawn
  mock.module('bun', () => ({ spawn: spawnMock }))

  const result = await runFFmpeg(['-i', 'input.mp4', 'output.wav'])
  expect(result).toBe(true)
  expect(spawnMock).toHaveBeenCalledWith(['ffmpeg', '-i', 'input.mp4', 'output.wav'])
})
```

#### Test Naming Conventions
- **Unit Tests**: `describe('functionName', () => { it('should do something specific', ...) })`
- **Integration Tests**: `describe('workflowName', () => { it('should handle end-to-end scenario', ...) })`
- **Test Descriptions**: Clear, descriptive names explaining the expected behavior
- **Test File Naming**: `*.test.ts` for unit tests, `*.spec.ts` for integration tests

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

### Logging and Debugging
```typescript
// Use console.log for user-facing messages and progress updates
console.log(`Uploading ${file} as "${title}"...`)

// Use console.error for error reporting
console.error(`Failed to process ${file}: ${error.message}`)

// For debugging, use descriptive variable names and comments
// Avoid excessive logging in production code - keep it minimal and informative
```

### Development Workflow
1. **Before committing**: Run `bun run check` to ensure code quality
2. **Test locally**: Run relevant tests with `bun test <file>` (heavy tests auto-skip)
3. **Type check**: Run `bun tsc --noEmit` for type safety
4. **Unused code**: Run `bun run knip` to check for dead code
5. **Commit**: Use conventional commit format with detailed body
6. **Push**: Let CI validate the changes before merging
7. **Review**: Use PRs for all changes, even solo development

### Git Hooks (Lefthook)
- **Pre-commit**: Biome formatting, TypeScript checking, knip, fast tests
- **Pre-push**: Full linting, full TypeScript, knip, full tests
- **Commit-msg**: Commitlint for conventional commits

### Configurable Options
The `YouTubeBatchUploader` class accepts configurable options:
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

## Framework-Specific Guidelines

### Bun Runtime Guidelines
- **Use Bun APIs**: Prefer `Bun.file()`, `Bun.write()`, `Bun.spawn()` for performance
- **Module Resolution**: Leverage Bun's bundler-friendly module resolution
- **Environment Variables**: Access via `process.env['VAR_NAME']` with bracket notation
- **Type Definitions**: Use `@types/bun` for proper TypeScript support

### YouTube Data API v3 Guidelines
- **Authentication**: Always use OAuth2 with token persistence
- **Scopes**: Include both upload and readonly scopes for verification
- **Rate Limits**: Implement exponential backoff for quota handling
- **Error Handling**: Check for specific API errors (quota exceeded, invalid credentials)
- **Metadata Validation**: Verify all required fields before upload

### FFmpeg Integration Guidelines
- **Command Construction**: Build commands as arrays to avoid shell injection
- **Output Handling**: Capture both stdout and stderr for debugging
- **Timeout Management**: Set reasonable timeouts for long-running operations
- **File Validation**: Check file existence and format before processing

### Python Integration Guidelines
- **Virtual Environment**: Always use venv for Python dependencies
- **Process Communication**: Use stdin/stdout for data exchange with Python scripts
- **Error Propagation**: Capture and forward Python script errors to TypeScript
- **Dependency Management**: Pin versions in requirements.txt

## Common Patterns, Best Practices, and Anti-Patterns

### Core Patterns
- **Functional Programming Style**: Pure functions with minimal side effects, composing operations through function calls rather than class inheritance.
- **Configuration Objects**: Complex operations parameterized via strongly-typed options objects (e.g., `BatchUploadOptions`) instead of long parameter lists.
- **Path Manipulation**: Always use `node:path` utilities for cross-platform compatibility, avoiding string concatenation for paths.
- **Async/Await Over Promises**: Convert error-first callbacks to async/await patterns for cleaner, more readable code.
- **JSDoc Documentation**: All public APIs must have JSDoc comments with `@param` and `@returns` descriptions.
- **Consistent Return Types**: Use `Promise<T>` for all async operations, maintaining type safety throughout.
- **Conditional Test Execution**: Heavy tests run only in CI using `runHeavyTest` helper to optimize local development.
- **Bun-Optimized I/O**: Prefer `Bun.file()`, `Bun.write()`, and `Bun.spawn()` for performance-critical file operations.

### Best Practices
- **Type Safety First**: Enable all strict TypeScript checks; avoid `any` types except for external API responses with biome ignores.
- **Error Resilience**: Always handle errors gracefully with descriptive messages; use exponential backoff for retries.
- **Resource Cleanup**: Explicitly clean up temporary files and streams to prevent resource leaks.
- **Modular Design**: Keep functions focused on single responsibilities; compose larger operations from smaller, testable units.
- **Security Awareness**: Validate all inputs, sanitize file paths, and avoid shell injection in external commands.
- **Performance Optimization**: Use streaming for large files, set reasonable timeouts, and leverage Bun's optimized APIs.
- **Test Isolation**: Each test should be completely independent with its own mocks and cleanup.
- **Documentation Updates**: Update AGENTS.md and inline docs when adding new patterns or changing existing ones.

### Anti-Patterns to Avoid
- **Avoid Synchronous File I/O**: Never use blocking file operations for large files; always use async/streaming alternatives.
- **No Global State**: Avoid global variables or shared mutable state; use dependency injection and local scope.
- **Avoid Magic Numbers**: Define constants for any hardcoded values like timeouts, retries, or buffer sizes.
- **No Silent Failures**: Always log errors and provide meaningful feedback; don't swallow exceptions.
- **Avoid Over-Abstraction**: Don't create unnecessary abstractions; prefer simple, direct solutions.
- **No Hardcoded Paths**: Use path utilities and configuration objects instead of hardcoded strings.
- **Avoid Race Conditions**: Properly handle async operations to prevent concurrent access issues.
- **No Large Test Files**: Keep test files focused; split large test suites into multiple files.

### Domain-Specific Patterns

**YouTube API Integration**:
- Always use OAuth2 with token persistence for authentication
- Implement retry logic with exponential backoff for network resilience
- Validate all metadata (titles, descriptions) before upload
- Handle quota limits gracefully with appropriate delays

**Video Processing**:
- Use FFmpeg for all video operations with proper error handling
- Validate file formats and durations before processing
- Clean up temporary files immediately after use
- Support streaming for large video files to prevent memory issues

**External Process Management**:
- Use `Bun.spawn()` for all external commands (FFmpeg, Python scripts)
- Capture both stdout and stderr for debugging
- Set appropriate timeouts to prevent hanging processes
- Validate exit codes and handle failures gracefully

**File I/O Patterns**:
- Use `Bun.file()` for reading configuration and small files
- Use streams (`fs.createReadStream`) for large video files
- Always validate file existence before operations
- Use temporary directories (`mkdtempSync`) for intermediate files

### AI Assistant Integration
- **Cursor Rules**: No specific Cursor rules configured (.cursor/rules/ or .cursorrules not found)
- **GitHub Copilot Instructions**: No custom Copilot instructions (.github/copilot-instructions.md not found)
- Use this comprehensive AGENTS.md as the primary guide for all coding activities in this repository
- Follow the established patterns, best practices, and anti-patterns outlined above for new contributions
- Reference the project architecture and domain-specific guidelines when implementing new features