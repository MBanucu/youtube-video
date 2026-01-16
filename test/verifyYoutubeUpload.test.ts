// test/verifyYoutubeUpload.test.ts

import { expect, test } from 'bun:test'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setupGoogleAuthMock } from './youtubeTestHelpers'

// Setup the Google Auth mock
setupGoogleAuthMock()

test('verifyVideo throws error when video is not found', async () => {
  const { startMockServer, stopMockServer } = await import(
    './mockYoutubeServer'
  )
  const port = 4000
  await startMockServer(port)
  process.env['YOUTUBE_ROOT_URL'] = `http://localhost:${port}/`

  // Create temp dir and fake credentials/token files
  const tempDir = mkdtempSync(join(tmpdir(), 'youtube-verify-test-'))
  const credentialsPath = join(tempDir, 'credentials.json')
  const tokenPath = join(tempDir, 'token.json')

  try {
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
        expiry_date: Date.now() + 86400000,
      }),
    )

    const { YouTubeUploadVerifier } = await import('../src/verifyYoutubeUpload')

    const verifier = new YouTubeUploadVerifier(credentialsPath, tokenPath)
    const fakeVideoId = 'non-existent-video-id'

    expect(
      verifier.verifyVideo(
        fakeVideoId,
        {
          title: 'Test Title',
          description: 'Test Description',
          categoryId: '22',
          privacyStatus: 'private',
        },
        1,
        10,
      ), // maxAttempts=1, delayMs=10 to speed up test
    ).rejects.toThrowError(`Video ${fakeVideoId} not found on channel`)
  } finally {
    stopMockServer(port)
    delete process.env['YOUTUBE_ROOT_URL']
  }
})
