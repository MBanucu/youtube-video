// src/types.ts - Type definitions for the YouTube upload functionality

export type YouTubePrivacyStatus = 'public' | 'private' | 'unlisted'

export interface BatchUploadOptions {
  credentialsPath: string
  videosDir?: string
  descriptionsDir?: string
  tokenPath?: string
  categoryId?: string
  privacyStatus?: YouTubePrivacyStatus
  maxRetries?: number
  retryDelay?: number
  verifyUploads?: boolean
  useMockApi?: boolean // Enable API call rerouting to localhost:4000 for testing
}

export interface ClientCredentials {
  installed: {
    client_id: string
    client_secret: string
    redirect_uris: string[]
  }
}
