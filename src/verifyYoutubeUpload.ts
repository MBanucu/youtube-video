// src/verifyYoutubeUpload.ts

import type { OAuth2Client } from 'google-auth-library'
import { google } from 'googleapis'

export interface ExpectedVideoMetadata {
  title: string
  description: string
  categoryId: string
  privacyStatus: 'public' | 'private' | 'unlisted'
}

export class YouTubeUploadVerifier {
  private auth: OAuth2Client

  constructor(auth: OAuth2Client) {
    this.auth = auth
  }

  async verifyVideo(
    videoId: string,
    expected: ExpectedVideoMetadata,
    maxAttempts: number = 5,
    delayMs: number = 3000,
  ): Promise<void> {
    const service = google.youtube({
      version: 'v3',
      auth: this.auth,
    })

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await service.videos.list({
          part: ['snippet', 'status'],
          id: [videoId],
        })

        const items = response.data.items
        if (!items || items.length === 0) {
          throw new Error(`Video ${videoId} not found on channel`)
        }

        const video = items[0]
        if (!video) {
          throw new Error(`Video ${videoId} not found in response`)
        }
        if (!video.snippet || !video.status) {
          throw new Error(`Video ${videoId} missing snippet or status`)
        }
        const snippet = video.snippet
        const status = video.status

        if (snippet.title !== expected.title) {
          throw new Error(
            `Title mismatch: expected "${expected.title}", got "${snippet.title}"`,
          )
        }
        if (snippet.description !== expected.description) {
          throw new Error(
            `Description mismatch: expected length ${expected.description.length}, got ${snippet.description?.length ?? 0}`,
          )
        }
        if (snippet.categoryId !== expected.categoryId) {
          throw new Error(
            `Category mismatch: expected "${expected.categoryId}", got "${snippet.categoryId}"`,
          )
        }
        if (status.privacyStatus !== expected.privacyStatus) {
          throw new Error(
            `Privacy mismatch: expected "${expected.privacyStatus}", got "${status.privacyStatus}"`,
          )
        }

        console.log(`Verification successful for video ${videoId}`)
        return
      } catch (error: any) {
        if (attempt === maxAttempts) {
          throw error
        }
        console.log(
          `Verification attempt ${attempt} failed: ${error.message}. Retrying in ${delayMs}ms...`,
        )
        await new Promise((resolve) => setTimeout(resolve, delayMs))
      }
    }
  }
}
