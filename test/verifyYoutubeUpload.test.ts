// test/verifyYoutubeUpload.test.ts

import { expect, mock, test } from 'bun:test'
import { OAuth2Client } from 'google-auth-library'

test('verifyVideo throws error when video is not found', async () => {
  const { startMockServer, stopMockServer } = await import(
    './mockYoutubeServer'
  )
  const port = 4000
  await startMockServer(port)
  process.env['YOUTUBE_ROOT_URL'] = `http://localhost:${port}/`

  try {
    const { YouTubeUploadVerifier } = await import('../src/verifyYoutubeUpload')

    const verifier = new YouTubeUploadVerifier(
      mockOAuth2Client() as OAuth2Client,
    )
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
    stopMockServer()
    delete process.env['YOUTUBE_ROOT_URL']
  }
})

// Create a real OAuth2Client for making actual HTTP requests (redirected to mock server)
const realOAuth2Client = new OAuth2Client({
  clientId: 'dummy-client-id',
  clientSecret: 'dummy-client-secret',
  redirectUri: 'urn:ietf:wg:oauth:2.0:oob',
})
realOAuth2Client.setCredentials({
  access_token: 'dummy-access-token',
  refresh_token: 'dummy-refresh-token',
})

// Mock setup - OAuth2Client for testing
const mockOAuth2Client = mock(
  (): Partial<OAuth2Client> => ({
    credentials: {
      access_token: 'mock-token',
      expiry_date: Date.now() + 86400000,
    },
    generateAuthUrl: mock(() => 'http://mock-auth-url'),
    getToken: mock(() =>
      Promise.resolve({
        tokens: { access_token: 'mock-token' },
        res: null,
      } as any),
    ),
    request: mock(async (options: any): Promise<any> => {
      // Replace YouTube API URLs with localhost mock server
      if (
        options.url &&
        options.url.includes &&
        options.url.includes('youtube.googleapis.com')
      ) {
        options.url = options.url.replace(
          'https://youtube.googleapis.com',
          'http://localhost:4000',
        )
      }
      // Call the real OAuth2Client.request method
      return realOAuth2Client.request(options)
    }),
  }),
)

mock.module('google-auth-library', () => ({
  OAuth2Client: mockOAuth2Client,
}))
