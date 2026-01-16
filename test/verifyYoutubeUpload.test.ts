// test/verifyYoutubeUpload.test.ts

import { expect, mock, test } from 'bun:test'
import type { OAuth2Client } from 'google-auth-library'

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
  }),
)

mock.module('google-auth-library', () => ({
  OAuth2Client: mockOAuth2Client,
}))
