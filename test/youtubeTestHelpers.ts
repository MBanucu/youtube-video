// test/youtubeTestHelpers.ts

import { mock } from 'bun:test'
import { OAuth2Client } from 'google-auth-library'
import type { GaxiosPromise } from 'googleapis-common'

// Create a real OAuth2Client for making actual HTTP requests (redirected to mock server)
export const realOAuth2Client = new OAuth2Client({
  clientId: 'dummy-client-id',
  clientSecret: 'dummy-client-secret',
  redirectUri: 'urn:ietf:wg:oauth:2.0:oob',
})
realOAuth2Client.credentials = {
  access_token: 'dummy-access-token',
  refresh_token: 'dummy-refresh-token',
}

// Shared mock setup for OAuth2Client
export const sharedOAuth2ClientMock = mock(() => ({
  credentials: {
    access_token: 'mock-token',
    expiry_date: Date.now() + 86400000,
  },
  generateAuthUrl: mock(() => 'http://mock-auth-url'),
  getToken: mock(() =>
    Promise.resolve({ tokens: { access_token: 'mock-token' } }),
  ),
  request: mock(
    <T>(options: Parameters<OAuth2Client['request']>[0]): GaxiosPromise<T> => {
      // Replace YouTube API URLs with localhost mock server
      if (
        options.url &&
        typeof options.url === 'string' &&
        options.url.includes('youtube.googleapis.com')
      ) {
        options.url = options.url.replace(
          'https://youtube.googleapis.com',
          'http://localhost:4000',
        )
      }
      // Call the real OAuth2Client.request method
      return realOAuth2Client.request<T>(options)
    },
  ),
}))

// Mock GoogleAuth class that can be extended
class MockGoogleAuth extends OAuth2Client {
  // biome-ignore lint/complexity/noUselessConstructor: Constructor needed for mock extendability
  constructor(options?: ConstructorParameters<typeof OAuth2Client>[0]) {
    super(options)
  }
}

// Mock DefaultTransporter
class MockDefaultTransporter {
  request() {}
}

// Setup function to mock the google-auth-library module
export function setupGoogleAuthMock() {
  mock.module('google-auth-library', () => ({
    OAuth2Client: sharedOAuth2ClientMock,
    GoogleAuth: MockGoogleAuth,
    DefaultTransporter: MockDefaultTransporter,
  }))
}
