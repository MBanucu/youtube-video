// src/verifyYoutubeUpload.ts

import type { OAuth2Client } from 'google-auth-library'
import type { youtube_v3 } from 'googleapis'
import { google } from 'googleapis'
import { logger } from './logger'
import type { YouTubePrivacyStatus } from './types'
import { YouTubeAuthenticator } from './youtubeAuthenticator'

type YouTubeService = ReturnType<typeof google.youtube>

export interface ExpectedVideoMetadata {
  title: NonNullable<youtube_v3.Schema$VideoSnippet['title']>
  description: NonNullable<youtube_v3.Schema$VideoSnippet['description']>
  categoryId: NonNullable<youtube_v3.Schema$VideoSnippet['categoryId']>
  privacyStatus: YouTubePrivacyStatus
}

export class YouTubeUploadVerifier {
  private authenticator: YouTubeAuthenticator

  constructor(credentialsPath: string, tokenPath?: string)
  constructor(auth: OAuth2Client)
  constructor(
    credentialsPathOrAuth: string | OAuth2Client,
    tokenPath?: string,
  ) {
    if (typeof credentialsPathOrAuth === 'string') {
      this.authenticator = new YouTubeAuthenticator(
        credentialsPathOrAuth,
        tokenPath,
      )
    } else {
      this.authenticator = new YouTubeAuthenticator(credentialsPathOrAuth)
    }
  }

  private async fetchVideoData(
    service: YouTubeService,
    videoId: string,
    maxAttempts: number,
    delayMs: number,
  ): Promise<{
    video: youtube_v3.Schema$Video
    snippet: NonNullable<youtube_v3.Schema$Video['snippet']>
    status: NonNullable<youtube_v3.Schema$Video['status']>
  }> {
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

        return {
          video,
          snippet: video.snippet,
          status: video.status,
        }
      } catch (error: unknown) {
        if (attempt === maxAttempts) {
          throw error
        }
        logger.warn(
          `Failed to fetch video ${videoId}: ${error instanceof Error ? error.message : String(error)}. Retrying in ${delayMs}ms...`,
        )
        await new Promise((resolve) => setTimeout(resolve, delayMs))
      }
    }
    // This should never be reached due to the throw in the catch block above
    throw new Error(`Failed to fetch video data for ${videoId}`)
  }

  async verifyVideo(
    videoId: string,
    expected: ExpectedVideoMetadata,
    maxAttempts: number = 5,
    delayMs: number = 3000,
  ): Promise<void> {
    const youtubeOptions: Parameters<typeof google.youtube>[0] = {
      version: 'v3',
      auth: await this.authenticator.getAuth(),
    }

    const service = google.youtube(youtubeOptions)

    // First, try to fetch the video data (retry on network/API errors)
    const { snippet, status } = await this.fetchVideoData(
      service,
      videoId,
      maxAttempts,
      delayMs,
    )

    // Now validate the video data (no retries for validation errors)

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

    logger.info(`Verification successful for video ${videoId}`)
  }
}
