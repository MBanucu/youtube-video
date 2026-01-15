// test/verifyYoutubeUpload.test.ts

import { expect, mock, test } from 'bun:test'
import { sharedFakeGoogleServer } from './fakeGoogleServer'

// Mock setup
const mockOAuth2Client = mock(() => ({
  credentials: {},
}))

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

test('verifyVideo throws error when video is null in response items', async () => {
  const { YouTubeUploadVerifier } = await import('../src/verifyYoutubeUpload')

  // Override the list method to return an array with null as first item
  const originalList = sharedFakeGoogleServer.list.bind(sharedFakeGoogleServer)
  // biome-ignore lint/suspicious/noExplicitAny: Mock implementation
  mockGoogleService.videos.list = mock(() =>
    Promise.resolve({
      data: {
        items: [null], // items has length 1 but first item is null
      },
    } as any),
  )

  const verifier = new YouTubeUploadVerifier(mockOAuth2Client() as any)
  const fakeVideoId = 'fake-video-id'

  try {
    await verifier.verifyVideo(
      fakeVideoId,
      {
        title: 'Test Title',
        description: 'Test Description',
        categoryId: '22',
        privacyStatus: 'private',
      },
      1,
      10,
    ) // maxAttempts=1, delayMs=10 to speed up test
    throw new Error('Expected error to be thrown')
  } catch (error) {
    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toBe(
      `Video ${fakeVideoId} not found in response`,
    )
  } finally {
    // Restore original list method
    mockGoogleService.videos.list = originalList
  }
})
