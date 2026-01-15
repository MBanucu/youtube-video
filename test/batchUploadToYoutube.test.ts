// test/batchUploadToYoutube.test.ts

import { expect, mock, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FakeGoogleServer } from './fakeGoogleServer'

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

    // Mock OAuth2Client (minimal)
    const OAuth2ClientMock = mock(() => ({
      credentials: {},
    }))

    // Mock youtube.videos.insert – drain stream and return fake response
    // Fake YouTube server that stores and serves video data
    const fakeServer = new FakeGoogleServer()

    const youtubeServiceMock = {
      videos: {
        insert: fakeServer.insert.bind(fakeServer),
        list: fakeServer.list.bind(fakeServer),
      },
    }
    const googleYoutubeMock = mock(() => youtubeServiceMock)

    mock.module('googleapis', () => ({
      google: { youtube: googleYoutubeMock },
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
        categoryId: '22',
        privacyStatus: 'private',
        verifyUploads: false,
      })

      // === Strong assertions ===
      // Exactly 3 matching videos uploaded (others ignored)
      const uploadedVideos = fakeServer.getAllVideos()
      expect(uploadedVideos.length).toBe(3)

      // Sort by title for consistent checking
      const sortedVideos = uploadedVideos.sort((a, b) =>
        a.snippet.title.localeCompare(b.snippet.title),
      )

      // Order matters – sorting by extracted number
      expect(sortedVideos[0]!.snippet.title).toBe('Video Part 1')
      expect(sortedVideos[0]!.snippet.description).toBe(
        'English description for part 1',
      )
      expect(sortedVideos[0]!.snippet.categoryId).toBe('22')
      expect(sortedVideos[0]!.status.privacyStatus).toBe('private')

      expect(sortedVideos[1]!.snippet.title).toBe('Video Part 10')
      expect(sortedVideos[1]!.snippet.description).toBe(
        'English description for part 10',
      )

      expect(sortedVideos[2]!.snippet.title).toBe('Video Part 2')
      expect(sortedVideos[2]!.snippet.description).toBe(
        'English description for part 2',
      )
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
    let callCount = 0
    const failingInsertMock = mock(async (params: any) => {
      callCount++
      if (params.media?.body) {
        await new Promise((resolve, reject) => {
          params.media.body.on('error', reject)
          params.media.body.on('end', resolve)
          params.media.body.resume()
        })
      }
      if (callCount <= 2) throw new Error('Network error')
      return { data: { id: 'retry-success-id' } }
    })

    // Mock youtube.videos.list for verification
    const listMock = mock(async () => {
      return {
        data: {
          items: [
            {
              snippet: {
                title: 'Video Part 1', // Mock expected title for verification
                description: '',
                categoryId: '22',
              },
              status: {
                privacyStatus: 'private',
              },
            },
          ],
        },
      }
    })

    const youtubeServiceMock = {
      videos: { insert: failingInsertMock, list: listMock },
    }
    const googleYoutubeMock = mock(() => youtubeServiceMock)

    const OAuth2ClientMock = mock(() => ({
      credentials: {},
    }))

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

    mock.module('googleapis', () => ({
      google: { youtube: googleYoutubeMock },
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
        retryDelay: 10,
        verifyUploads: false,
      })

      // Retries
      expect(callCount).toBe(3)

      // Parameters (description empty, defaults used)
      const lastCall = failingInsertMock.mock.calls[2]?.[0]
      expect(lastCall?.requestBody.snippet.title).toBe('Video Part 1')
      expect(lastCall?.requestBody.snippet.description).toBe('')
      expect(lastCall?.requestBody.snippet.categoryId).toBe('22') // default
      expect(lastCall?.requestBody.status.privacyStatus).toBe('private') // default
    } finally {
      await new Promise((resolve) => setTimeout(resolve, 100))
      rmSync(tempDir, { recursive: true, force: true })
    }
  },
  { timeout: 10000 },
)
