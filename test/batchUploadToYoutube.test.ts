// test/batchUploadToYoutube.test.ts

import { expect, mock, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { OAuth2Client } from 'google-auth-library'
import type { youtube_v3 } from 'googleapis'
import { sharedFakeGoogleServer } from './fakeGoogleServer'

// Use actual YouTube Data API v3 types
type YouTubeVideo = youtube_v3.Schema$Video

// Shared mock setup for all tests
const sharedOAuth2ClientMock = mock(() => ({
  credentials: {},
}))

const sharedGoogleServiceMock = {
  videos: {
    insert: sharedFakeGoogleServer.insert.bind(sharedFakeGoogleServer),
    list: sharedFakeGoogleServer.list.bind(sharedFakeGoogleServer),
  },
}

mock.module('googleapis', () => ({
  google: { youtube: () => sharedGoogleServiceMock },
}))

mock.module('google-auth-library', () => ({
  OAuth2Client: sharedOAuth2ClientMock,
}))

test(
  'main should authorize, find videos, filter/sort correctly, load descriptions, and upload with correct parameters',
  async () => {
    // Create temp dir and fake files
    const tempDir = mkdtempSync(join(tmpdir(), 'youtube-test-'))
    const credentialsPath = join(tempDir, 'credentials.json')
    const tokenPath = join(tempDir, 'token.json')
    const fakeVideosDir = join(tempDir, 'videos')
    const fakeDescriptionsDir = join(tempDir, 'descriptions')

    mkdirSync(fakeVideosDir)
    mkdirSync(fakeDescriptionsDir)

    // Video files – include extra files to test filtering and sorting
    writeFileSync(join(fakeVideosDir, 'part1.MTS'), '')
    writeFileSync(join(fakeVideosDir, 'part2.MTS'), '')
    writeFileSync(join(fakeVideosDir, 'part10.MTS'), '') // tests numeric sorting
    writeFileSync(join(fakeVideosDir, 'other.MTS'), '') // should be ignored
    writeFileSync(join(fakeVideosDir, 'intro.MTS'), '') // should be ignored

    // Description files – different text so we can verify correct pairing
    writeFileSync(
      join(fakeDescriptionsDir, 'part1-description_en.txt'),
      'English description for part 1',
    )
    writeFileSync(
      join(fakeDescriptionsDir, 'part2-description_en.txt'),
      'English description for part 2',
    )
    writeFileSync(
      join(fakeDescriptionsDir, 'part10-description_en.txt'),
      'English description for part 10',
    )

    // Fake credentials and existing token (so it loads token, no interactive flow)
    writeFileSync(
      credentialsPath,
      JSON.stringify({
        installed: {
          client_id: 'fake-client-id',
          client_secret: 'fake-secret',
          redirect_uris: ['urn:ietf:wg:oauth:2.0:oob'],
        },
      }),
    )
    writeFileSync(
      tokenPath,
      JSON.stringify({
        access_token: 'fake-access-token',
        refresh_token: 'fake-refresh-token',
        expiry_date: Date.now() + 3600000,
      }),
    )

    const { YouTubeBatchUploader } = await import('../src/batchUploadToYoutube')

    try {
      const uploader = new YouTubeBatchUploader({
        credentialsPath,
        videosDir: fakeVideosDir,
        descriptionsDir: fakeDescriptionsDir,
        tokenPath,
        categoryId: '22',
        privacyStatus: 'private',
        verifyUploads: true,
      })
      const uploadResponses = await uploader.uploadBatch()

      // === Strong assertions ===
      // Verify specific videos were uploaded with correct properties
      const uploadedVideos = uploadResponses.map((response) => response.data)

      // Check that we have the expected videos by their properties
      const videosPart1 = uploadedVideos.filter(
        (v: YouTubeVideo) => v.snippet?.title === 'Video Part 1',
      )
      const videosPart2 = uploadedVideos.filter(
        (v: YouTubeVideo) => v.snippet?.title === 'Video Part 2',
      )
      const videosPart10 = uploadedVideos.filter(
        (v: YouTubeVideo) => v.snippet?.title === 'Video Part 10',
      )

      // Should have at least one of each
      expect(videosPart1.length).toBeGreaterThan(0)
      expect(videosPart2.length).toBeGreaterThan(0)
      expect(videosPart10.length).toBeGreaterThan(0)

      // Check that the expected descriptions are present
      const hasPart1WithDesc = videosPart1.some(
        (v: YouTubeVideo) =>
          v.snippet?.description === 'English description for part 1',
      )
      const hasPart10WithDesc = videosPart10.some(
        (v: YouTubeVideo) =>
          v.snippet?.description === 'English description for part 10',
      )
      const hasPart2WithDesc = videosPart2.some(
        (v: YouTubeVideo) =>
          v.snippet?.description === 'English description for part 2',
      )

      expect(hasPart1WithDesc).toBe(true)
      expect(hasPart10WithDesc).toBe(true)
      expect(hasPart2WithDesc).toBe(true)
    } finally {
      await new Promise((resolve) => setTimeout(resolve, 100))
      rmSync(tempDir, { recursive: true, force: true })
    }
  },
  { timeout: 5000 },
)

test(
  'should retry uploads on failure with exponential backoff and use defaults when options omitted',
  async () => {
    // Use shared server with configured failures
    const fakeServer = sharedFakeGoogleServer
    // Make first 2 insert calls fail, then succeed
    fakeServer.setInsertFailures(2)

    // Temp setup – only one video, no description file
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
      JSON.stringify({
        installed: {
          client_id: 'fake-client-id',
          client_secret: 'fake-secret',
          redirect_uris: ['urn:ietf:wg:oauth:2.0:oob'],
        },
      }),
    )
    writeFileSync(
      tokenPath,
      JSON.stringify({
        access_token: 'fake-access-token',
        refresh_token: 'fake-refresh-token',
        expiry_date: Date.now() + 3600000,
      }),
    )

    const { YouTubeBatchUploader } = await import('../src/batchUploadToYoutube')

    try {
      const uploader = new YouTubeBatchUploader({
        credentialsPath,
        videosDir: fakeVideosDir,
        descriptionsDir: fakeDescriptionsDir,
        tokenPath,
        maxRetries: 2,
        retryDelay: 10,
        verifyUploads: true,
      })
      const uploadResponses = await uploader.uploadBatch()

      // Verify the video was uploaded after retries
      const uploadedVideos = uploadResponses.map((response) => response.data)

      // Find the video with empty description specifically
      const video = uploadedVideos.find(
        (v: YouTubeVideo) =>
          v.snippet?.title === 'Video Part 1' && v.snippet?.description === '',
      )
      expect(video).toBeDefined()
      expect(video?.snippet?.categoryId).toBe('22') // default
      expect(video?.status?.privacyStatus).toBe('private') // default
    } finally {
      await new Promise((resolve) => setTimeout(resolve, 100))
      rmSync(tempDir, { recursive: true, force: true })
    }
  },
  { timeout: 10000 },
)

// NEW: Test with local mock YouTube API server
import { startMockServer, stopMockServer } from './mockYoutubeServer'

test(
  'uploads batch with local mock YouTube API server',
  async () => {
    const port = 4000

    // Start mock server
    await startMockServer(port)

    const tempDir = mkdtempSync(join(tmpdir(), 'youtube-test-'))

    try {
      const fakeVideosDir = join(tempDir, 'videos')
      const fakeDescriptionsDir = join(tempDir, 'descriptions')
      mkdirSync(fakeVideosDir)
      mkdirSync(fakeDescriptionsDir)

      // Create fake video file
      const videoPath = join(fakeVideosDir, 'part1.MTS')
      writeFileSync(videoPath, 'fake video content')

      // Create description file
      const descPath = join(fakeDescriptionsDir, 'part1-description_en.txt')
      writeFileSync(descPath, 'Test description from mock server')

      // Mock OAuth2Client for testing
      const mockOAuth2Client = mock(
        (): Partial<OAuth2Client> => ({
          credentials: {
            access_token: 'dummy-access-token',
            expiry_date: Date.now() + 86400000,
          },
        }),
      )

      mock.module('google-auth-library', () => ({
        OAuth2Client: mockOAuth2Client,
      }))

      // Don't mock googleapis - let it use the real service with HTTP interception

      // Create dummy credentials file
      const credentialsPath = join(tempDir, 'credentials.json')
      writeFileSync(
        credentialsPath,
        JSON.stringify({
          installed: {
            client_id: 'dummy-client-id',
            client_secret: 'dummy-client-secret',
            redirect_uris: ['http://localhost'],
          },
        }),
      )

      const { YouTubeBatchUploader } = await import(
        '../src/batchUploadToYoutube'
      )

      const uploader = new YouTubeBatchUploader({
        credentialsPath,
        videosDir: fakeVideosDir,
        descriptionsDir: fakeDescriptionsDir,
        categoryId: '22',
        privacyStatus: 'private',
        useMockApi: true, // enables API call rerouting to localhost:4000
        maxRetries: 1,
        retryDelay: 10,
      })

      const responses = await uploader.uploadBatch()

      expect(responses.length).toBeGreaterThan(0)
      for (const resp of responses) {
        expect(resp.status).toBe(200)
        expect(resp.data.id).toBeDefined()
        expect(resp.data.snippet?.title).toBe('Video Part 1')
        expect(resp.data.snippet?.description).toBe(
          'Test description from mock server',
        )
        expect(resp.data.snippet?.categoryId).toBe('22')
        expect(resp.data.status?.privacyStatus).toBe('private')
      }
    } finally {
      stopMockServer()
      // Clean up temp directory
      await new Promise((resolve) => setTimeout(resolve, 100))
      rmSync(tempDir, { recursive: true, force: true })
    }
  },
  { timeout: 30000 },
)
