# AGENTS.md - YouTube Video Automation Project

This file contains comprehensive information for AI coding agents working on this YouTube video automation project. It includes detailed build/lint/test commands, extensive code style guidelines, complete project architecture overview, and thorough documentation of all patterns and practices.

## Table of Contents

1. [Project Overview](#project-overview)
2. [Project Architecture](#project-architecture)
3. [Important Files & Directories](#important-files--directories)
4. [Build/Lint/Test Commands](#buildlinttest-commands)
5. [Code Style Guidelines](#code-style-guidelines)
6. [Framework-Specific Guidelines](#framework-specific-guidelines)
7. [Common Patterns & Best Practices](#common-patterns--best-practices)
8. [Development Workflow](#development-workflow)
9. [AI Assistant Integration](#ai-assistant-integration)

## Project Overview

This is a TypeScript project using Bun runtime for automating YouTube video processing tasks including:
- Video splitting and concatenation with precise timing
- Audio extraction and WAV conversion
- AI-powered transcription using faster-whisper
- AI-powered description generation using OpenCode CLI
- Batch processing workflows with progress tracking
- YouTube upload with OAuth2 authentication and metadata verification
- Local mock YouTube API server for comprehensive integration testing

**Key Features:**
- **Zero-config setup**: Works out-of-the-box with sensible defaults
- **Type-safe**: Full TypeScript support with strict type checking
- **Performance optimized**: Uses Bun's fast runtime and optimized APIs
- **CI/CD ready**: Comprehensive test suite with GitHub Actions integration
- **Error resilient**: Exponential backoff retry logic and comprehensive error handling

## Project Architecture

### High-Level Architecture

The project follows a modular, pipeline-based architecture designed for automated video processing workflows:

```
Raw Video Files → Video Processing → Audio Processing → AI Processing → YouTube Upload
     ↓              ↓                ↓              ↓              ↓
   .MTS files    Splitting/        WAV extraction   Transcription   Batch upload
                  Concatenation                      Description     with retry
                                                   generation       logic
```

**Data Flow:**
1. **Input**: Raw `.MTS` video files from `videosDir`
2. **Processing**: FFmpeg-based splitting and concatenation with precise timestamps
3. **Audio**: WAV extraction for AI transcription (Python + faster-whisper)
4. **AI**: Description generation using OpenCode CLI with multiple languages
5. **Upload**: YouTube API v3 integration with OAuth2 and verification

### Core Architectural Principles

- **Functional Programming**: Pure functions with minimal side effects
- **Configuration-Driven**: Complex operations parameterized via options objects
- **Error Resilience**: Comprehensive error handling with exponential backoff
- **Streaming I/O**: Large file handling without memory issues
- **Testability**: Modular design enabling comprehensive unit testing
- **Type Safety**: Strict TypeScript with no `any` types in production code

### Key Components

#### 1. Video Processing Layer (`*-mts.ts` files)
**Purpose**: Handle video file operations using FFmpeg with surgical precision.

**Components:**
- `split_video_precise.ts`: Duration-based video splitting with frame accuracy
- `concat-mts.ts`: Multi-video concatenation with metadata preservation
- `split_video_precise_check.ts`: Validation and quality assurance for splits

**Key Features:**
- Precise timestamp-based splitting (e.g., `00:12:34.567`)
- Duration validation and overlap detection
- Temporary file cleanup and error recovery
- FFmpeg command construction with shell injection prevention

#### 2. Audio Processing Layer (`*-wav.ts` files)
**Purpose**: Extract audio tracks and prepare for AI transcription.

**Components:**
- `extract-wav.ts`: High-quality WAV extraction from video files

**Key Features:**
- Lossless audio extraction using FFmpeg
- WAV format optimization for speech recognition
- Automatic file cleanup and validation
- Bun.spawn() integration for performance

#### 3. AI Processing Layer (External integrations)
**Purpose**: Leverage AI for content enhancement and automation.

**Components:**
- `batchTranscribe.test.ts`: Python faster-whisper integration
- `batchGenerateDescription.test.ts`: OpenCode CLI description generation

**Key Features:**
- Multi-language transcription support
- Contextual description generation
- Conditional execution (CI-only for performance)
- Error handling for external process failures

#### 4. YouTube Integration Layer (`batchUploadToYoutube.ts`)
**Purpose**: Complete YouTube upload workflow with verification.

**Key Classes:**
- `YouTubeBatchUploader`: Main upload orchestrator
- `YouTubeUploadVerifier`: Post-upload metadata validation

**Features:**
- OAuth2 authentication with automatic token persistence
- Batch upload with configurable retry logic (exponential backoff)
- Metadata validation (title, description, category, privacy)
- Progress tracking and error reporting
- Rate limit handling and quota management
- Optional local mock server support for testing

#### 5. Mock YouTube Server Layer (`test/mockYoutubeServer.ts`)
**Purpose**: Local HTTP mock server for comprehensive integration testing.

**Key Functions:**
- `startMockServer(port)`: Start mock server on specified port
- `stopMockServer()`: Stop the running mock server

**Features:**
- Simulates YouTube Data API v3 `videos.insert` and `videos.list` endpoints
- Supports both resumable and multipart upload flows
- In-memory storage of uploaded video metadata
- HTTP streaming support for realistic testing
- Configurable server port (default: 4000)

#### 5. Configuration & Types Layer (`types.ts`, `paths.ts`)
**Purpose**: Strongly typed configuration and path management.

**Key Interfaces:**
```typescript
interface BatchUploadOptions {
  credentialsPath: string
  videosDir?: string
  descriptionsDir?: string
  tokenPath?: string
  categoryId?: string         // YouTube category ID
  privacyStatus?: YouTubePrivacyStatus  // 'public' | 'private' | 'unlisted'
  maxRetries?: number         // Default: 3
  retryDelay?: number         // Base delay in ms, default: 1000
  mockServerUrl?: string      // For local mock server testing
}

interface ClientCredentials {
  clientId: string
  clientSecret: string
  redirectUri: string
}
```

## Important Files & Directories

### Core Source Files (`src/`)

| File | Purpose | Key Functions |
|------|---------|---------------|
| `batchUploadToYoutube.ts` | Main YouTube uploader with OAuth2 and batch processing | `uploadBatch()`, `uploadVideoWithRetry()`, `verifyVideo()` |
| `verifyYoutubeUpload.ts` | Post-upload verification system | `verifyVideo()`, `fetchVideoData()` |
| `types.ts` | TypeScript interfaces and type definitions | `BatchUploadOptions`, `ExpectedVideoMetadata` |
| `paths.ts` | Path configuration and directory management | Path utilities and defaults |
| `utils.ts` | Shared utility functions | File validation, error formatting |

### Test Infrastructure (`test/`)

| File | Purpose | Test Focus |
|------|---------|------------|
| `batchUploadToYoutube.test.ts` | YouTube upload functionality | Auth, batch processing, retries, API responses |
| `verifyYoutubeUpload.test.ts` | Upload verification system | Video existence checking, metadata validation |
| `fakeGoogleServer.ts` | Legacy YouTube API mocking | HTTP response simulation, error scenarios |
| `mockYoutubeServer.ts` | Local HTTP mock server | Comprehensive integration testing with real HTTP |
| `utils.ts` | Test utilities | `runHeavyTest` for conditional execution |
| `*-mts.test.ts` | Video processing tests | FFmpeg integration, file operations |
| `extract-wav.test.ts` | Audio extraction tests | WAV conversion, file validation |

### Test Data & Assets (`testdata/`)

- **`.MTS` files**: Sample video files for processing tests
- **`.txt` files**: Expected transcription and description outputs

### Configuration Files

| File | Purpose | Key Settings |
|------|---------|--------------|
| `biome.json` | Linting and formatting | Single quotes, 2-space indent, custom rules |
| `tsconfig.json` | TypeScript compilation | Strict mode, Bun compatibility, path aliases |
| `lefthook.yml` | Git hooks | Pre-commit: fast tests + linting, Pre-push: full suite |
| `package.json` | Dependencies and scripts | Bun runtime, Google APIs, FFmpeg integration, Biome, TypeScript |

### CI/CD Infrastructure (`.github/workflows/`)

- **`test.yml`**: Matrix testing strategy with FFmpeg/Python setup
- **Conditional concurrency**: Prevents redundant CI runs
- **Dependency caching**: Optimized build performance

### External Dependencies & Tools

| Tool | Purpose | Integration |
|------|---------|-------------|
| **FFmpeg** | Video/audio processing | `Bun.spawn()` with command arrays |
| **Python + faster-whisper** | AI transcription | Subprocess communication |
| **OpenCode CLI** | AI description generation | External command execution |
| **Bun runtime** | Fast JavaScript execution | Native APIs, optimized I/O |
| **Google APIs** | YouTube integration | OAuth2, Data API v3 |

## Build/Lint/Test Commands

### Dependencies & Setup
```bash
bun install                    # Install all dependencies
bun install -d                 # Install only dev dependencies
bun update                     # Update dependencies
```

### Code Quality Checks
```bash
bun run check                  # Run linting, formatting, and type checking (comprehensive)
bun run lint                   # Lint code only (Biome)
bun run fmt                    # Format code only (Biome)
bun tsc --noEmit              # TypeScript type checking only
bun run knip                  # Check for unused dependencies/code
```

### Testing Commands

#### Run All Tests
```bash
bun test                       # Run all tests concurrently (fast mode)
bun test --verbose            # Run with detailed output
```

#### Run Specific Tests
```bash
# Run single test file
bun test test/batchUploadToYoutube.test.ts

# Run multiple specific files
bun test test/extract-wav.test.ts test/concat-mts.test.ts

# Run with coverage (if configured)
bun test --coverage
```

#### Run Single Tests or Test Cases
```bash
# Run only tests whose name contains "mock"
bun test --test-name-pattern="mock"

# Run only tests whose name contains "upload"
bun test --test-name-pattern="upload"

# Run tests starting with "should"
bun test --test-name-pattern="^should"

# Run specific test in a file
bun test test/batchUploadToYoutube.test.ts --test-name-pattern="uploads batch"

# Alternative short form
bun test -t "mock server"
```

**Test Name Pattern Examples:**
- `-t "integration"` - matches any test with "integration" in the name
- `-t "^should"` - matches tests starting with "should"
- `-t "(upload|verify)"` - matches tests containing "upload" OR "verify"
- `-t "2 \+ 2"` - matches tests with special characters (escape them)

#### Run Tests by Pattern
```bash
# Run all video processing tests
bun test *-mts.test.ts

# Run all audio tests
bun test *-wav.test.ts

# Run YouTube integration tests
bun test *youtube*.test.ts
```

#### Conditional Test Execution
Heavy tests (transcription, description generation) run only in CI:
```typescript
import { runHeavyTest } from './test/utils'

runHeavyTest('AI transcription workflow', async () => {
  // Only runs in CI environment
}, { timeout: 300000 })
```

### CI Pipeline Commands
The project uses GitHub Actions with:
- **Matrix testing**: Each test file runs in parallel
- **Conditional execution**: Heavy tests skip locally
- **Artifact collection**: Test results and coverage reports

### Development Commands
```bash
# Full pre-commit checks (mimics git hooks)
bun run check && bun test --concurrent

# Quick iteration (skip heavy tests)
bun run lint && bun tsc --noEmit

# Clean install and verify
rm -rf node_modules bun.lock && bun install && bun test
```

## Code Style Guidelines

### TypeScript Configuration
```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "preserve",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "allowSyntheticDefaultImports": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@test/*": ["test/*"]
    }
  }
}
```

### Biome Configuration
```json
{
  "linter": {
    "rules": {
      "recommended": true,
      "complexity": {
        "useLiteralKeys": "off"  // Allow bracket notation for env vars
      },
      "suspicious": {
        "noControlCharactersInRegex": "off"
      }
    }
  },
  "formatter": {
    "indentStyle": "space",
    "indentWidth": 2,
    "quoteStyle": "single",
    "semicolons": "asNeeded"
  }
}
```

### Import/Export Patterns

#### Node.js Built-ins
```typescript
// Correct: Use node: prefix for Bun compatibility
import { join, resolve } from 'node:path'
import { createReadStream } from 'node:fs'
import { tmpdir, platform } from 'node:os'

// Incorrect: Will work but less explicit
import { join } from 'path'
```

#### Bun Runtime APIs
```typescript
// Use Bun's optimized APIs for performance
import { spawn, file, write } from 'bun'

// File I/O optimization
const content = await Bun.file('config.json').text()
await Bun.write('output.txt', data)
```

#### Project Modules
```typescript
// Use path aliases for clean imports
import { BatchUploadOptions } from '@/types'
import { runHeavyTest } from '@test/utils'

// Third-party libraries
import { google } from 'googleapis'
import yargs from 'yargs'
```

#### Export Patterns
```typescript
// Object exports for related functionality
export const config = {
  apiUrl: process.env['API_URL'] || 'https://api.example.com',
  timeout: 5000,
  retries: 3,
}

// Named exports for utilities
export function validatePath(path: string): boolean {
  return path.startsWith('/') && !path.includes('..')
}

// Default export for main classes
export default class YouTubeBatchUploader {
  // Implementation
}
```

### Naming Conventions

#### Files & Directories
```typescript
// kebab-case for files
video-processor.ts
extract-wav.ts
batch-upload-to-youtube.ts

// PascalCase for directories (if needed)
src/
test/
TestData/
```

#### Functions & Variables
```typescript
// camelCase for functions and variables
function extractWavFromVideo(inputVideo: string, outputWav: string): boolean
const outputPath = join(tmpdir(), 'output.wav')
let retryCount = 0

// Private members with underscore prefix
class VideoProcessor {
  private _config: Config
  private _tempFiles: string[] = []
}
```

#### Types & Interfaces
```typescript
// PascalCase for types
interface BatchUploadOptions {
  videosDir: string
  categoryId: string
}

type VideoProcessingResult = {
  success: boolean
  outputPath?: string
  error?: string
}

// Generic type parameters
type ApiResponse<T> = {
  data: T
  status: number
  message?: string
}
```

#### Constants
```typescript
// UPPER_SNAKE_CASE for constants
const MAX_RETRIES = 3
const DEFAULT_TIMEOUT = 30000
const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3'

// Magic numbers get named constants
const BUFFER_SIZE = 64 * 1024
const FRAME_RATE = 30
```

#### Classes
```typescript
class YouTubeBatchUploader {
  // Implementation
}

class VideoProcessor {
  // Implementation
}
```

### Error Handling Patterns

#### Synchronous Errors
```typescript
function validateVideoFile(filePath: string): void {
  if (!existsSync(filePath)) {
    throw new Error(`Video file not found: ${filePath}`)
  }

  if (!filePath.endsWith('.MTS')) {
    throw new Error(`Invalid video format. Expected .MTS, got: ${filePath}`)
  }
}
```

#### Asynchronous Errors with Retry
```typescript
async function uploadWithRetry(videoPath: string, maxRetries: number): Promise<void> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      await uploadVideo(videoPath)
      return // Success
    } catch (error: unknown) {
      if (attempt === maxRetries) {
        throw error // Final failure
      }

      const delay = Math.pow(2, attempt) * 1000 // Exponential backoff
      console.log(`Upload failed, retrying in ${delay}ms...`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
}
```

#### Error Types and Classification
```typescript
// Custom error types for better error handling
class ValidationError extends Error {
  constructor(message: string, public field: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

class NetworkError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message)
    this.name = 'NetworkError'
  }
}

// Usage
function validateInput(input: string): void {
  if (!input.trim()) {
    throw new ValidationError('Input cannot be empty', 'input')
  }
}

async function apiCall(): Promise<void> {
  try {
    await fetchData()
  } catch (error: unknown) {
    if (error instanceof NetworkError && error.statusCode === 429) {
      // Rate limited, implement backoff
      await delay(60000)
      return apiCall()
    }
    throw error
  }
}
```

### Async/Await Patterns

#### Sequential Operations
```typescript
async function processVideoPipeline(videoPath: string): Promise<ProcessingResult> {
  // Sequential processing - each step depends on the previous
  const splitResult = await splitVideo(videoPath, '00:30:00')
  const audioResult = await extractAudio(splitResult.outputPath)
  const transcription = await transcribeAudio(audioResult.outputPath)
  const description = await generateDescription(transcription)

  return {
    videoPath: splitResult.outputPath,
    audioPath: audioResult.outputPath,
    transcription,
    description,
  }
}
```

#### Parallel Operations
```typescript
async function processBatch(files: string[]): Promise<ProcessingResult[]> {
  // Parallel processing - operations are independent
  const promises = files.map(async (file) => {
    const [audio, transcription] = await Promise.all([
      extractAudio(file),
      transcribeAudio(file),
    ])

    return {
      file,
      audioPath: audio.outputPath,
      transcription,
    }
  })

  return Promise.all(promises)
}
```

#### Error Recovery in Parallel Operations
```typescript
async function processBatchWithErrorRecovery(files: string[]): Promise<ProcessingResult[]> {
  const results = await Promise.allSettled(
    files.map(file => processSingleFile(file))
  )

  const successful: ProcessingResult[] = []
  const failed: string[] = []

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      successful.push(result.value)
    } else {
      console.error(`Failed to process ${files[index]}:`, result.reason)
      failed.push(files[index])
    }
  })

  if (failed.length > 0) {
    console.warn(`Failed to process ${failed.length} files:`, failed)
  }

  return successful
}
```

### Documentation Standards

#### JSDoc for Public APIs
```typescript
/**
 * Uploads a batch of video files to YouTube with automatic metadata verification.
 *
 * @param options - Configuration options for the upload process
 * @returns Promise resolving to array of YouTube API upload responses
 *
 * @example
 * ```typescript
 * const uploader = new YouTubeBatchUploader({
 *   credentialsPath: './credentials.json',
 *   videosDir: './videos',
 *   categoryId: '22',
 *   privacyStatus: 'private'
 * })
 *
 * const responses = await uploader.uploadBatch()
 * console.log(`Uploaded ${responses.length} videos`)
 * ```
 *
 * @throws {Error} When no video files are found
 * @throws {Error} When authentication fails
 */
async uploadBatch(): Promise<GaxiosResponseWithHTTP2<youtube_v3.Schema$Video>[]> {
  // Implementation
}
```

#### Inline Comments for Complex Logic
```typescript
async function uploadVideoWithRetry(
  service: YouTubeService,
  videoPath: string,
  title: string,
  description: string,
  categoryId: string,
  privacyStatus: string,
): Promise<GaxiosResponseWithHTTP2<youtube_v3.Schema$Video>> {
  // Exponential backoff: delay increases as 2^attempt * baseDelay
  // This handles temporary network issues and API rate limits
  for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
    try {
      // Construct YouTube API request with required metadata
      const response = await service.videos.insert({
        part: ['snippet', 'status'],
        requestBody: {
          snippet: { title, description, categoryId },
          status: { privacyStatus },
        },
        media: { body: fs.createReadStream(videoPath) },
      })

      return response
    } catch (error) {
      // Don't retry on final attempt
      if (attempt === this.maxRetries) {
        throw error
      }

      // Exponential backoff with jitter to avoid thundering herd
      const baseDelay = this.retryDelay * Math.pow(2, attempt)
      const jitter = Math.random() * 1000 // Up to 1 second jitter
      const delay = baseDelay + jitter

      console.log(`Upload failed, retrying in ${Math.round(delay)}ms...`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
}
```

### Testing Patterns

#### Unit Test Structure
```typescript
import { expect, mock, test } from 'bun:test'
import { YouTubeBatchUploader } from '../src/batchUploadToYoutube'

// Test setup
test('uploadBatch returns array of API responses', async () => {
  // Arrange
  const uploader = new YouTubeBatchUploader({
    credentialsPath: './test-creds.json',
    videosDir: './test-videos',
  })

  // Act
  const responses = await uploader.uploadBatch()

  // Assert
  expect(Array.isArray(responses)).toBe(true)
  expect(responses.length).toBeGreaterThan(0)
  responses.forEach(response => {
    expect(response.data.id).toBeDefined()
    expect(response.status).toBe(200)
  })
})
```

#### Mock Setup for External Dependencies
```typescript
// Mock Google APIs (legacy approach)
const mockGoogleService = {
  videos: {
    insert: mock(() => Promise.resolve({
      data: { id: 'test-video-id' },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
      ok: true,
    })),
  },
}

mock.module('googleapis', () => ({
  google: { youtube: () => mockGoogleService },
}))
```

#### Integration Testing with Mock Server
```typescript
// Modern approach: Use local mock YouTube server
import { startMockServer, stopMockServer } from './mockYoutubeServer'

test('uploads batch with local mock YouTube API server', async () => {
  const port = 4000
  await startMockServer(port)

  try {
    const uploader = new YouTubeBatchUploader({
      credentialsPath: 'dummy',
      videosDir: fakeVideosDir,
      descriptionsDir: fakeDescriptionsDir,
      mockServerUrl: `http://localhost:${port}`, // Enables mock server
    })

    const responses = await uploader.uploadBatch()
    expect(responses.length).toBeGreaterThan(0)
  } finally {
    stopMockServer()
  }
}, { timeout: 30000 })
```

#### Test Organization and Naming
```typescript
// describe blocks for grouping related tests
describe('YouTubeBatchUploader', () => {
  describe('uploadBatch', () => {
    test('returns array of API responses for successful uploads', async () => {
      // Test implementation
    })

    test('handles empty video directory gracefully', async () => {
      // Test implementation
    })

    test('retries failed uploads with exponential backoff', async () => {
      // Test implementation
    })
  })

  describe('authentication', () => {
    test('loads credentials from specified path', async () => {
      // Test implementation
    })

    test('handles invalid credentials gracefully', async () => {
      // Test implementation
    })
  })
})
```

#### Test Data Management
```typescript
// Temporary directories for test isolation
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'

test('video processing workflow', async () => {
  // Create isolated test directory
  const tempDir = mkdtempSync(join(tmpdir(), 'video-test-'))

  try {
    // Setup test files
    const inputPath = join(tempDir, 'input.MTS')
    const outputPath = join(tempDir, 'output.wav')

    // Copy test data
    await Bun.write(inputPath, await Bun.file('testdata/sample.MTS').arrayBuffer())

    // Test operation
    const result = await processVideo(inputPath, outputPath)

    // Assertions
    expect(result).toBe(true)
    expect(existsSync(outputPath)).toBe(true)

  } finally {
    // Always cleanup, even on failure
    rmSync(tempDir, { recursive: true, force: true })
  }
}, { timeout: 30000 })
```

## Framework-Specific Guidelines

### Bun Runtime Guidelines

#### Optimized File I/O
```typescript
// Use Bun.file() for small files and config
const config = await Bun.file('config.json').json()
const text = await Bun.file('description.txt').text()

// Use Node.js streams for large files
import { createReadStream } from 'node:fs'
const stream = createReadStream(largeVideoFile)

// Use Bun.write() for output
await Bun.write('output.json', JSON.stringify(data, null, 2))
```

#### Process Execution
```typescript
// Use Bun.spawn() for external commands
const ffmpeg = Bun.spawn([
  'ffmpeg',
  '-i', inputFile,
  '-ss', startTime,
  '-t', duration,
  '-c', 'copy',
  outputFile,
], {
  stdout: 'pipe',
  stderr: 'pipe',
})

// Handle output
const [success, errorOutput] = await Promise.all([
  ffmpeg.exited,
  new Response(ffmpeg.stderr).text(),
])

if (success !== 0) {
  throw new Error(`FFmpeg failed: ${errorOutput}`)
}
```

#### Environment Variables
```typescript
// Use bracket notation for dynamic env vars (Biome allows this)
const apiKey = process.env['API_KEY']
const logLevel = process.env['LOG_LEVEL'] || 'info'

// Type-safe environment configuration
interface EnvConfig {
  apiUrl: string
  timeout: number
  debug: boolean
}

const config: EnvConfig = {
  apiUrl: process.env['API_URL'] || 'https://api.example.com',
  timeout: parseInt(process.env['TIMEOUT'] || '30000'),
  debug: process.env['DEBUG'] === 'true',
}
```

### Google APIs Integration

#### Authentication Setup
```typescript
import { OAuth2Client } from 'google-auth-library'
import { google } from 'googleapis'

// OAuth2 client initialization
const oauth2Client = new OAuth2Client({
  clientId: credentials.clientId,
  clientSecret: credentials.clientSecret,
  redirectUri: credentials.redirectUri,
})

// Token persistence
const tokenPath = './youtube-token.json'
if (existsSync(tokenPath)) {
  const tokens = JSON.parse(await Bun.file(tokenPath).text())
  oauth2Client.setCredentials(tokens)
}

// YouTube service with auth
const youtube = google.youtube({
  version: 'v3',
  auth: oauth2Client,
})
```

#### Video Upload with Metadata
```typescript
const uploadResponse = await youtube.videos.insert({
  part: ['snippet', 'status'],
  requestBody: {
    snippet: {
      title: 'My Awesome Video',
      description: 'Generated description with AI',
      categoryId: '22', // People & Blogs
    },
    status: {
      privacyStatus: 'private', // or 'public', 'unlisted'
    },
  },
  media: {
    body: fs.createReadStream('video.mp4'),
  },
})

// Access uploaded video data
console.log('Uploaded video ID:', uploadResponse.data.id)
console.log('Upload status:', uploadResponse.status)
```

#### Error Handling for API Limits
```typescript
try {
  const response = await youtube.videos.list({ /* params */ })
  return response.data.items
} catch (error: any) {
  if (error.code === 403) {
    // Quota exceeded or access denied
    console.error('API quota exceeded or insufficient permissions')
  } else if (error.code === 429) {
    // Rate limited
    console.error('Rate limit exceeded, implementing backoff...')
    await delay(60000) // Wait 1 minute
    return retryOperation()
  }
  throw error
}
```

### FFmpeg Integration

#### Command Construction
```typescript
function buildFFmpegCommand(
  input: string,
  output: string,
  options: { start?: string; duration?: string; quality?: number }
): string[] {
  const cmd = ['ffmpeg']

  // Input file
  cmd.push('-i', input)

  // Seek to start time (if specified)
  if (options.start) {
    cmd.push('-ss', options.start)
  }

  // Duration limit
  if (options.duration) {
    cmd.push('-t', options.duration)
  }

  // Video quality
  if (options.quality) {
    cmd.push('-q:v', options.quality.toString())
  }

  // Copy codecs (no re-encoding for speed)
  cmd.push('-c', 'copy')

  // Output file
  cmd.push(output)

  return cmd
}
```

#### Safe Execution with Error Handling
```typescript
async function runFFmpeg(command: string[]): Promise<void> {
  const process = Bun.spawn(command, {
    stdout: 'pipe',
    stderr: 'pipe',
  })

  // Capture output for debugging
  const [stdout, stderr] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
  ])

  const exitCode = await process.exited

  if (exitCode !== 0) {
    console.error('FFmpeg command failed:')
    console.error('Command:', command.join(' '))
    console.error('Exit code:', exitCode)
    console.error('Stderr:', stderr)

    throw new Error(`FFmpeg failed with exit code ${exitCode}`)
  }

  console.log('FFmpeg completed successfully')
}
```

### YouTube API Integration

#### Privacy Status Handling
```typescript
// Use the strict YouTubePrivacyStatus type instead of strings
type YouTubePrivacyStatus = 'public' | 'private' | 'unlisted'

interface VideoMetadata {
  privacyStatus: YouTubePrivacyStatus  // ✅ Type-safe
  // privacyStatus: string              // ❌ Avoid - not type-safe
}

// Correct usage
const metadata: VideoMetadata = {
  privacyStatus: 'private'  // ✅ TypeScript validates this
}

// Avoid casting unless necessary for API compatibility
// const status = someValue as YouTubePrivacyStatus  // ❌ Only if absolutely needed
```

#### Video Upload Patterns
```typescript
// Always use proper error handling for uploads
try {
  const response = await youtube.videos.insert({
    part: ['snippet', 'status'],
    requestBody: {
      snippet: { title, description, categoryId },
      status: { privacyStatus },
    },
    media: { body: fs.createReadStream(videoPath) },
  })
} catch (error: any) {
  // Handle specific YouTube API errors
  if (error.code === 403) {
    throw new Error('YouTube API quota exceeded or insufficient permissions')
  }
  if (error.code === 429) {
    // Implement exponential backoff
    await delay(Math.pow(2, attempt) * 1000)
    return retryUpload()
  }
  throw error
}
```

#### Mock Server Usage
```typescript
// For integration testing, use the local mock server
const uploader = new YouTubeBatchUploader({
  // ... other options
  mockServerUrl: 'http://localhost:4000',  // Enables mock server
})

// The uploader will automatically use the mock server
// instead of the real YouTube API
const responses = await uploader.uploadBatch()
```

### Python Integration

#### Subprocess Communication
```typescript
async function runWhisperTranscription(audioPath: string): Promise<string> {
  const pythonCmd = [
    'python3',
    'scripts/transcribe.py',
    audioPath,
    '--model', 'medium',
    '--language', 'en',
  ]

  const process = Bun.spawn(pythonCmd, {
    stdout: 'pipe',
    stderr: 'pipe',
  })

  const [stdout, stderr] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
  ])

  const exitCode = await process.exited

  if (exitCode !== 0) {
    throw new Error(`Whisper transcription failed: ${stderr}`)
  }

  return stdout.trim()
}
```

#### Virtual Environment Management
```typescript
// Use absolute path to virtual environment Python
const venvPython = join(projectRoot, 'venv', 'bin', 'python3')

// Ensure virtual environment exists
if (!existsSync(venvPython)) {
  throw new Error('Python virtual environment not found. Run: python3 -m venv venv')
}

const transcriptionCmd = [
  venvPython,
  'scripts/transcribe.py',
  audioPath,
  '--output-dir', outputDir,
]
```

## Common Patterns & Best Practices

### Core Patterns

#### Configuration Objects
```typescript
// Good: Configuration object for complex operations
interface UploadConfig {
  videosDir: string
  descriptionsDir: string
  categoryId: string
  privacyStatus: 'public' | 'private' | 'unlisted'
  maxRetries: number
  retryDelay: number
}

async function uploadBatch(config: UploadConfig): Promise<UploadResult[]> {
  // Implementation uses config object
}

// Bad: Long parameter lists
async function uploadBatch(
  videosDir: string,
  descriptionsDir: string,
  categoryId: string,
  privacyStatus: string,
  maxRetries: number,
  retryDelay: number,
): Promise<UploadResult[]> {
  // Hard to maintain and error-prone
}
```

#### Path Manipulation
```typescript
// Good: Use node:path utilities
import { join, resolve, dirname, basename } from 'node:path'

const videoPath = join(videosDir, 'input.MTS')
const outputDir = dirname(videoPath)
const filename = basename(videoPath, '.MTS')

// Bad: String concatenation
const videoPath = videosDir + '/input.MTS' // Platform-dependent
```

#### Async/Await Best Practices
```typescript
// Good: Sequential operations
async function processPipeline(input: string): Promise<Result> {
  const step1 = await validateInput(input)
  const step2 = await processData(step1)
  const step3 = await saveResult(step2)
  return step3
}

// Good: Parallel operations
async function processBatch(inputs: string[]): Promise<Result[]> {
  return Promise.all(inputs.map(input => processSingle(input)))
}

// Good: Error recovery
async function processWithFallback(input: string): Promise<Result> {
  try {
    return await primaryMethod(input)
  } catch (error) {
    console.warn('Primary method failed, using fallback:', error)
    return await fallbackMethod(input)
  }
}
```

### Best Practices

#### Security First
```typescript
// ✅ Store credentials securely, never in code
const credentialsPath = process.env['GOOGLE_CREDENTIALS_PATH']
if (!credentialsPath) {
  throw new Error('GOOGLE_CREDENTIALS_PATH environment variable required')
}

// ✅ Validate file paths to prevent directory traversal
const safePath = resolve(allowedDir, userInput)
if (!safePath.startsWith(allowedDir)) {
  throw new Error('Invalid file path')
}

// ✅ Use proper error handling to avoid information leakage
try {
  await uploadVideo(videoPath)
} catch (error: unknown) {
  // Don't log sensitive details
  console.error('Upload failed:', error instanceof Error ? error.message : 'Unknown error')
  throw new Error('Video upload failed')
}
```

#### Type Safety First
```typescript
// ✅ Use strict TypeScript settings
// ✅ Avoid any types in production code
// ✅ Leverage union types for constrained values
// ✅ Use interface/type aliases for complex objects
// ✅ Enable all strict compiler options
```

#### Error Resilience
```typescript
// ✅ Handle errors gracefully with descriptive messages
// ✅ Implement exponential backoff for retries
// ✅ Clean up resources in error paths
// ✅ Log errors with context for debugging
// ✅ Don't swallow errors silently
```

#### Performance Optimization
```typescript
// ✅ Use Bun.spawn() for external processes
// ✅ Leverage Bun.file() and Bun.write() for I/O
// ✅ Handle large files with streams
// ✅ Set reasonable timeouts
// ✅ Use concurrent test execution
```

#### Resource Management
```typescript
// ✅ Clean up temporary files immediately
// ✅ Use try/finally for resource cleanup
// ✅ Close streams and file handles
// ✅ Handle process termination gracefully
```

### Anti-Patterns to Avoid

#### Synchronous File I/O
```typescript
// ❌ DON'T: Blocking I/O for large files
const data = readFileSync('large-video.mp4') // Blocks event loop

// ✅ DO: Use streams or async methods
const stream = createReadStream('large-video.mp4')
```

#### Global State
```typescript
// ❌ DON'T: Global mutable state
let globalConfig: Config

// ✅ DO: Dependency injection
class Processor {
  constructor(private config: Config) {}
}
```

#### Magic Numbers
```typescript
// ❌ DON'T: Unexplained numbers
if (attempts > 3) break

// ✅ DO: Named constants
const MAX_RETRIES = 3
if (attempts > MAX_RETRIES) break
```

#### Silent Failures
```typescript
// ❌ DON'T: Swallow errors
try {
  await riskyOperation()
} catch {
  // Silent failure - hard to debug
}

// ✅ DO: Handle and log errors
try {
  await riskyOperation()
} catch (error: unknown) {
  console.error('Operation failed:', error)
  throw error // Re-throw or handle appropriately
}
```

## Development Workflow

### Daily Development Cycle

1. **Start Development**
   ```bash
   # Pull latest changes
   git pull origin main
   
   # Install dependencies (if needed)
   bun install
   
   # Run tests to ensure clean slate
   bun test
   ```

2. **Feature Development**
   ```bash
   # Create feature branch
   git checkout -b feature/youtube-upload-improvements

   # Make changes with iterative testing
   bun run lint  # Quick feedback
   bun test -t "specific test"  # Run single test case
   bun test test/specific-test.test.ts  # Test specific file

   # For YouTube API changes, use mock server for fast testing
   bun test -t "mock server"  # Test with local mock server
   ```

3. **Pre-Commit Quality Checks**
   ```bash
   # Full quality check (same as git hooks)
   bun run check
   bun tsc --noEmit
   bun run knip
   
   # Run relevant tests
   bun test --concurrent test/related-tests.test.ts
   ```

4. **Commit with Conventional Format**
   ```bash
   git add .
   git commit -m "feat: add YouTube upload progress tracking
   
   - Add progress callback to uploadBatch method
   - Track individual video upload status
   - Provide real-time feedback during long uploads
   - Update tests to verify progress reporting"
   ```

5. **Push and Create PR**
   ```bash
   git push -u origin feature/youtube-upload-improvements
   gh pr create --title "feat: YouTube upload progress tracking" --body "..." --base main
   ```

### Git Hooks and Quality Gates

The project uses Lefthook for automated quality checks:

**Pre-commit:**
- Fast test suite (core functionality)
- Biome linting and formatting
- TypeScript compilation
- Dead code detection

**Pre-push:**
- Full test suite
- Complete linting and formatting
- TypeScript type checking
- Dependency analysis

**Commit-msg:**
- Conventional commit format validation

### Code Review Checklist

**For Authors:**
- [ ] All tests pass
- [ ] No linting errors
- [ ] TypeScript compilation succeeds
- [ ] Documentation updated
- [ ] Breaking changes documented

**For Reviewers:**
- [ ] Code follows established patterns
- [ ] Error handling is comprehensive
- [ ] Performance considerations addressed
- [ ] Tests provide adequate coverage
- [ ] Documentation is clear and complete

### Release Process

1. **Version Bump**: Update version in package.json
2. **Changelog**: Document changes since last release
3. **Tag Creation**: Create git tag with version
4. **GitHub Release**: Create release with changelog
5. **Deployment**: Update deployment if applicable

## AI Assistant Integration

### Cursor Rules
No specific Cursor rules configured. The project uses standard Biome linting and TypeScript strict mode.

### GitHub Copilot Instructions
No custom Copilot instructions configured. Follow the patterns and conventions outlined in this document.

### Agent Guidelines

**Primary Reference**: Use this AGENTS.md as the authoritative guide for all coding activities in this repository.

**Recent Updates**: This document has been updated to include:
- Local mock YouTube API server for comprehensive integration testing
- Enhanced YouTube API type safety with proper Google API types
- Detailed single test execution instructions
- Security best practices for API key and credential handling
- Updated testing patterns including mock server usage

**Key Principles**:
- Follow the established patterns, best practices, and anti-patterns outlined above
- Maintain type safety and avoid `any` types in production code
- Use conventional commits for all changes
- Include comprehensive tests for new functionality
- Update documentation when changing APIs or adding features

**Code Generation Standards**:
- Use functional programming style with pure functions
- Implement comprehensive error handling with descriptive messages
- Follow the established naming conventions and import patterns
- Include JSDoc documentation for public APIs
- Write tests using the established patterns in test files
- Use the local mock YouTube server for integration testing
- Prefer Google API types over generic strings for type safety

**Quality Assurance**:
- Run `bun run check` before committing
- Ensure all tests pass with `bun test`
- Verify TypeScript compilation with `bun tsc --noEmit`
- Check for unused code with `bun run knip`

This comprehensive guide ensures consistent, high-quality contributions to the YouTube Video Automation Project. All AI assistants should internalize these guidelines and apply them consistently across all coding activities.</content>
<parameter name="filePath">/home/michi/dev/youtube-video/AGENTS.md