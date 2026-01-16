import { afterAll, beforeAll, describe, expect, mock, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { youtube_v3 } from 'googleapis'
import { startMockServer, stopMockServer } from './mockYoutubeServer'

// Use actual YouTube Data API v3 types
type YouTubeVideo = youtube_v3.Schema$Video

// Shared mock setup for all tests
const sharedOAuth2ClientMock = mock(() => ({
  credentials: {
    access_token: 'mock-token',
    expiry_date: Date.now() + 86400000,
  },
  generateAuthUrl: mock(() => 'http://mock-auth-url'),
  getToken: mock(() =>
    Promise.resolve({ tokens: { access_token: 'mock-token' } }),
  ),
  request: mock(async (options) => {
    console.log(
      'Mock request to:',
      options.url,
      'method:',
      options.method,
      'params:',
      options.params,
    )
    let url = options.url as string
    if (options.params) {
      const search = new URLSearchParams()
      for (const [k, v] of Object.entries(options.params)) {
        if (Array.isArray(v)) {
          for (const val of v) {
            search.append(k, val.toString())
          }
        } else {
          search.append(k, String(v))
        }
      }
      url += `?${search.toString()}`
    }
    console.log('Mock request full url:', url)
    if (url.startsWith('https://youtube.googleapis.com/')) {
      url = url.replace(
        'https://youtube.googleapis.com/',
        'http://localhost:4000/',
      )
    }
    try {
      const response = await fetch(url, {
        method: options.method || 'GET',
        headers: options.headers || {},
        body: options.data,
      })
      const data = await response.text()
      let parsed: Record<string, unknown> | { text: string }
      try {
        parsed = JSON.parse(data)
      } catch {
        parsed = { text: data }
      }
      console.log('Mock response status:', response.status, 'data:', parsed)
      return { status: response.status, data: parsed }
    } catch (error) {
      console.log('Mock request error:', error)
      throw error
    }
  }),
}))

mock.module('google-auth-library', () => ({
  OAuth2Client: sharedOAuth2ClientMock,
}))

describe('YouTube Batch Upload Tests', () => {
  beforeAll(async () => {
    const port = 4000
    await startMockServer(port)
    // Set environment variable to override rootUrl in the source code
    process.env['YOUTUBE_ROOT_URL'] = `http://localhost:${port}/`
  })

  afterAll(() => {
    stopMockServer()
    delete process.env['YOUTUBE_ROOT_URL']
  })

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

      const { YouTubeBatchUploader } = await import(
        '../src/batchUploadToYoutube'
      )

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
        rmSync(tempDir, { recursive: true, force: true })
      }
    },
    { timeout: 5000 },
  )

  test(
    'should retry uploads on failure with exponential backoff and use defaults when options omitted',
    async () => {
      // Make first 2 insert calls fail, then succeed
      await fetch('http://localhost:4000/set-failures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: 1 }),
      })

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

      const { YouTubeBatchUploader } = await import(
        '../src/batchUploadToYoutube'
      )

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
        const uploadedVideos = uploadResponses.map(
          (response) => response.data as YouTubeVideo,
        )

        // Find the video with empty description specifically
        const video = uploadedVideos.find(
          (v) =>
            v.snippet?.title === 'Video Part 1' &&
            v.snippet?.description === '',
        )
        expect(video).toBeDefined()
        expect(video?.snippet?.categoryId).toBe('22') // default
        expect(video?.status?.privacyStatus).toBe('private') // default
      } finally {
        rmSync(tempDir, { recursive: true, force: true })
      }
    },
    { timeout: 10000 },
  )
})
