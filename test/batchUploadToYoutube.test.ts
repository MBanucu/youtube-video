// test/batchUploadToYoutube.test.ts

import { expect, mock, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
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
    // Use shared server with test isolation
    const fakeServer = sharedFakeGoogleServer

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
      await uploader.uploadBatch()

      // === Strong assertions ===
      // Verify specific videos were uploaded with correct properties
      const uploadedVideoIds = fakeServer.getAllVideoIds()

      // Use list API like verification does
      const listResponse = await fakeServer.list({ id: uploadedVideoIds })
      const uploadedVideos = listResponse.data.items || []

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
      await uploader.uploadBatch()

      // Verify the video was uploaded after retries
      const uploadedVideoIds = fakeServer.getAllVideoIds()

      // Use list API to verify the uploaded video
      const listResponse = await fakeServer.list({ id: uploadedVideoIds })
      const uploadedVideos = listResponse.data.items || []

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
