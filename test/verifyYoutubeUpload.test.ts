// test/verifyYoutubeUpload.test.ts

import { expect, mock, test } from 'bun:test'
import type { OAuth2Client } from 'google-auth-library'
import { sharedFakeGoogleServer } from './fakeGoogleServer'

test('verifyVideo throws error when video is not found', async () => {
  const { YouTubeUploadVerifier } = await import('../src/verifyYoutubeUpload')

  const verifier = new YouTubeUploadVerifier(mockOAuth2Client() as OAuth2Client)
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
})

// Mock setup - minimal OAuth2Client for testing
const mockOAuth2Client = mock(
  (): Partial<OAuth2Client> => ({
    credentials: {},
  }),
)

const mockGoogleService = {
  videos: {
    list: sharedFakeGoogleServer.list.bind(sharedFakeGoogleServer),
  },
}

mock.module('googleapis', () => ({
  google: { youtube: () => mockGoogleService },
}))

mock.module('google-auth-library', () => ({
  OAuth2Client: mockOAuth2Client,
}))
