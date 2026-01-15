// test/batchUploadToYoutube.test.ts

import { expect, mock, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Mock console.log to capture output without printing
const consoleLogMock = mock(() => {})

// Mock google.youtube service
// biome-ignore lint/suspicious/noExplicitAny: any allows flexible mocking of stream body
const insertMock = mock(async (params: { media?: { body?: any } }) => {
  const { media } = params
  if (media?.body) {
    // Drain the stream to simulate consumption and ensure file closure
    await new Promise((resolve, reject) => {
      media.body.on('error', reject)
      media.body.on('end', resolve)
      media.body.resume() // Start flowing data to trigger 'end'
    })
  }
  return { data: { id: 'fake-video-id' } }
})
const youtubeServiceMock = {
  videos: {
    insert: insertMock,
  },
}
const googleYoutubeMock = mock(() => youtubeServiceMock)

// Mock OAuth2Client
const OAuth2ClientMock = mock(
  (_clientId: string, _clientSecret: string, _redirectUri: string) => ({
    setCredentials: mock(() => {}),
    credentials: {},
  }),
)

// Import will be done inside the test

test(
  'main should authorize, find videos, and upload them with descriptions',
  async () => {
    // Create temp dir and fake files
    const tempDir = mkdtempSync(join(tmpdir(), 'youtube-test-'))
    const credentialsPath = join(tempDir, 'credentials.json')
    const tokenPath = join(tempDir, 'token.json')
    const fakeVideosDir = join(tempDir, 'videos')
    const fakeDescriptionsDir = join(tempDir, 'descriptions')

    // Create temp subdirs
    mkdirSync(fakeVideosDir)
    mkdirSync(fakeDescriptionsDir)

    // Create fake video files
    writeFileSync(join(fakeVideosDir, 'part1.MTS'), '')
    writeFileSync(join(fakeVideosDir, 'part2.MTS'), '')

    // Create fake description files
    writeFileSync(
      join(fakeDescriptionsDir, 'part1-description_en.txt'),
      'Fake description for testing',
    )
    writeFileSync(
      join(fakeDescriptionsDir, 'part2-description_en.txt'),
      'Fake description for testing',
    )

    writeFileSync(
      credentialsPath,
      JSON.stringify(
        {
          installed: {
            client_id: 'fake-client-id',
            client_secret: 'fake-secret',
            redirect_uris: ['urn:ietf:wg:oauth:2.0:oob'],
          },
        },
        null,
        2,
      ),
    )

    writeFileSync(
      tokenPath,
      JSON.stringify(
        {
          access_token: 'fake-access-token',
          refresh_token: 'fake-refresh-token',
          expiry_date: Date.now() + 3600000, // Valid in future
        },
        null,
        2,
      ),
    )

    // Mock console.log
    const originalConsoleLog = console.log
    console.log = consoleLogMock

    mock.module('googleapis', () => ({
      google: {
        youtube: googleYoutubeMock,
      },
    }))

    mock.module('google-auth-library', () => ({
      OAuth2Client: OAuth2ClientMock,
    }))

    // Import after mocks
    const { batchUploadToYoutube } = await import('../src/batchUploadToYoutube')

    try {
      // Call batchUploadToYoutube
      await batchUploadToYoutube({
        credentialsPath,
        videosDir: fakeVideosDir,
        descriptionsDir: fakeDescriptionsDir,
        tokenPath,
        categoryId: '22',
        privacyStatus: 'private',
        maxRetries: 2,
        retryDelay: 100,
      })

      // Assertions
      expect(consoleLogMock).toHaveBeenCalledWith(
        'Found 2 video parts to upload.',
      )
      expect(consoleLogMock).toHaveBeenCalledWith(
        'Uploading part1.MTS as "Video Part 1"...',
      )
      expect(consoleLogMock).toHaveBeenCalledWith(
        'Video uploaded successfully: https://youtu.be/fake-video-id',
      )
      expect(consoleLogMock).toHaveBeenCalledWith(
        'Uploading part2.MTS as "Video Part 2"...',
      )
      expect(consoleLogMock).toHaveBeenCalledWith(
        'Video uploaded successfully: https://youtu.be/fake-video-id',
      )
      expect(consoleLogMock).toHaveBeenCalledWith('All uploads complete.')
    } finally {
      // Cleanup - delay to allow any pending async file opens to complete
      await new Promise((resolve) => setTimeout(resolve, 100))
      console.log = originalConsoleLog
      rmSync(tempDir, { recursive: true, force: true })
    }
  },
  { timeout: 5000 },
)

test(
  'should retry uploads on failure with exponential backoff',
  async () => {
    let callCount = 0
    const failingInsertMock = mock(
      // biome-ignore lint/suspicious/noExplicitAny: Mock body type
      async (params: { media?: { body?: any } }) => {
        callCount++
        const { media } = params
        if (media?.body) {
          // Drain the stream
          await new Promise((resolve, reject) => {
            media.body.on('error', reject)
            media.body.on('end', resolve)
            media.body.resume()
          })
        }
        if (callCount <= 2) {
          throw new Error('Network error')
        }
        return { data: { id: 'retry-success-id' } }
      },
    )

    const youtubeServiceMockRetry = {
      videos: {
        insert: failingInsertMock,
      },
    }
    const googleYoutubeMockRetry = mock(() => youtubeServiceMockRetry)

    // Create temp dir and fake files
    const tempDir = mkdtempSync(join(tmpdir(), 'youtube-retry-test-'))
    const credentialsPath = join(tempDir, 'credentials.json')
    const tokenPath = join(tempDir, 'token.json')
    const fakeVideosDir = join(tempDir, 'videos')
    const fakeDescriptionsDir = join(tempDir, 'descriptions')

    mkdirSync(fakeVideosDir)
    mkdirSync(fakeDescriptionsDir)

    writeFileSync(join(fakeVideosDir, 'part1.MTS'), '')

    writeFileSync(
      credentialsPath,
      JSON.stringify(
        {
          installed: {
            client_id: 'fake-client-id',
            client_secret: 'fake-secret',
            redirect_uris: ['urn:ietf:wg:oauth:2.0:oob'],
          },
        },
        null,
        2,
      ),
    )

    writeFileSync(
      tokenPath,
      JSON.stringify(
        {
          access_token: 'fake-access-token',
          refresh_token: 'fake-refresh-token',
          expiry_date: Date.now() + 3600000,
        },
        null,
        2,
      ),
    )

    const originalConsoleLog = console.log
    console.log = consoleLogMock

    mock.module('googleapis', () => ({
      google: {
        youtube: googleYoutubeMockRetry,
      },
    }))

    mock.module('google-auth-library', () => ({
      OAuth2Client: OAuth2ClientMock,
    }))

    const { batchUploadToYoutube } = await import('../src/batchUploadToYoutube')

    try {
      await batchUploadToYoutube({
        credentialsPath,
        videosDir: fakeVideosDir,
        descriptionsDir: fakeDescriptionsDir,
        tokenPath,
        maxRetries: 2,
        retryDelay: 10, // Short delay for test
      })

      expect(callCount).toBe(3) // 1 initial + 2 retries
      expect(consoleLogMock).toHaveBeenCalledWith(
        'Video uploaded successfully: https://youtu.be/retry-success-id',
      )
    } finally {
      await new Promise((resolve) => setTimeout(resolve, 100))
      console.log = originalConsoleLog
      rmSync(tempDir, { recursive: true, force: true })
    }
  },
  { timeout: 10000 },
)
