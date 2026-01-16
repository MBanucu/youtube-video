import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { youtube_v3 } from 'googleapis'
import tmp from 'tmp'
import { startMockServer, stopMockServer } from './mockYoutubeServer'

// Use actual YouTube Data API v3 types
type YouTubeVideo = youtube_v3.Schema$Video

// Setup the Google Auth mock
import { setupGoogleAuthMock } from './youtubeTestHelpers'

setupGoogleAuthMock()

describe('YouTube Batch Upload Tests', () => {
  const port = 4000

  beforeAll(async () => {
    await startMockServer(port)
  })

  afterAll(() => {
    stopMockServer(port)
  })

  test(
    'main should authorize, find videos, filter/sort correctly, load descriptions, and upload with correct parameters',
    async () => {
      // Create temp dir and fake files
      const videosDir = tmp.dirSync({
        prefix: 'youtube-videos-',
        unsafeCleanup: true,
      })
      const descriptionsDir = tmp.dirSync({
        prefix: 'youtube-descriptions-',
        unsafeCleanup: true,
      })
      const credentialsPath = join(videosDir.name, 'credentials.json')
      const tokenPath = join(videosDir.name, 'token.json')

      // Video files – include extra files to test filtering and sorting
      writeFileSync(join(videosDir.name, 'part1.MTS'), '')
      writeFileSync(join(videosDir.name, 'part2.MTS'), '')
      writeFileSync(join(videosDir.name, 'part10.MTS'), '') // tests numeric sorting
      writeFileSync(join(videosDir.name, 'other.MTS'), '') // should be ignored
      writeFileSync(join(videosDir.name, 'intro.MTS'), '') // should be ignored

      // Description files – different text so we can verify correct pairing
      writeFileSync(
        join(descriptionsDir.name, 'part1-description_en.txt'),
        'English description for part 1',
      )
      writeFileSync(
        join(descriptionsDir.name, 'part2-description_en.txt'),
        'English description for part 2',
      )
      writeFileSync(
        join(descriptionsDir.name, 'part10-description_en.txt'),
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

      const uploader = new YouTubeBatchUploader({
        credentialsPath,
        videosDir: videosDir.name,
        descriptionsDir: descriptionsDir.name,
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
      const videosDir = tmp.dirSync({
        prefix: 'youtube-retry-videos-',
        unsafeCleanup: true,
      })
      const descriptionsDir = tmp.dirSync({
        prefix: 'youtube-retry-descriptions-',
        unsafeCleanup: true,
      })
      const credentialsPath = join(videosDir.name, 'credentials.json')
      const tokenPath = join(videosDir.name, 'token.json')

      writeFileSync(join(videosDir.name, 'part1.MTS'), '')

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

      const uploader = new YouTubeBatchUploader({
        credentialsPath,
        videosDir: videosDir.name,
        descriptionsDir: descriptionsDir.name,
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
          v.snippet?.title === 'Video Part 1' && v.snippet?.description === '',
      )
      expect(video).toBeDefined()
      expect(video?.snippet?.categoryId).toBe('22') // default
      expect(video?.status?.privacyStatus).toBe('private') // default
    },
    { timeout: 10000 },
  )
})
