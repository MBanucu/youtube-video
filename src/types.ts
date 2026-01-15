// src/types.ts - Type definitions for the YouTube upload functionality

export interface BatchUploadOptions {
  credentialsPath: string
  videosDir?: string
  descriptionsDir?: string
  tokenPath?: string
  categoryId?: string
  privacyStatus?: string
  maxRetries?: number
  retryDelay?: number
}

export interface ClientCredentials {
  installed: {
    client_id: string
    client_secret: string
    redirect_uris: string[]
  }
}
