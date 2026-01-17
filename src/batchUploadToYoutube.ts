import fs from 'node:fs'
import path from 'node:path'
import type { youtube_v3 } from 'googleapis'
import { google } from 'googleapis'
import type { GaxiosResponseWithHTTP2 } from 'googleapis-common'
import { getLogger } from './logging'
import './logging' // Configure LogTape globally

import type { YouTubePrivacyStatus } from './types'

type YouTubeService = ReturnType<typeof google.youtube>

import { paths } from './paths'
import type { BatchUploadOptions } from './types'
import { YouTubeAuthenticator } from './youtubeAuthenticator'

// Create child loggers for different operations
const batchLogger = getLogger({
  module: 'batch-upload',
  service: 'youtube-automation',
})
const uploadLogger = getLogger({
  module: 'video-upload',
  service: 'youtube-automation',
})
const retryLogger = getLogger({
  module: 'upload-retry',
  service: 'youtube-automation',
})

import { YouTubeUploadVerifier } from './verifyYoutubeUpload'

// YouTube video category ID (22 = People & Blogs; adjust as needed, e.g., 28 for Science & Technology)
const CATEGORY_ID = '22'

// Default privacy status for uploaded videos
const PRIVACY_STATUS = 'private' // Options: 'public', 'private', 'unlisted'

export class YouTubeBatchUploader {
  private options: BatchUploadOptions
  private authenticator: YouTubeAuthenticator
  private videosDir: string
  private descriptionsDir: string
  private maxRetries: number
  private retryDelay: number

  constructor(options: BatchUploadOptions) {
    this.options = options
    this.videosDir = options.videosDir || paths.videosDir
    this.descriptionsDir = options.descriptionsDir || paths.descriptionsDir
    this.authenticator = new YouTubeAuthenticator(
      options.credentialsPath,
      options.tokenPath,
    )
    this.maxRetries = options.maxRetries ?? 3
    this.retryDelay = options.retryDelay ?? 1000
  }

  async findVideoFiles(): Promise<string[]> {
    const files = await fs.promises.readdir(this.videosDir)
    return files
      .filter((f) => f.startsWith('part') && f.endsWith('.MTS'))
      .sort((a, b) => {
        const matchA = a.match(/part(\d+)/)
        const matchB = b.match(/part(\d+)/)
        const numA = matchA?.[1] ? parseInt(matchA[1], 10) : 0
        const numB = matchB?.[1] ? parseInt(matchB[1], 10) : 0
        return numA - numB
      })
  }

  async uploadBatch(): Promise<
    GaxiosResponseWithHTTP2<youtube_v3.Schema$Video>[]
  > {
    const videoFiles = await this.findVideoFiles()

    if (videoFiles.length === 0) {
      batchLogger.info(
        { videosDir: this.videosDir },
        'No split video files found in %s',
        this.videosDir,
      )
      return []
    }

    batchLogger.info(
      { count: videoFiles.length },
      'Found %d video parts to upload.',
      videoFiles.length,
    )

    const responses: GaxiosResponseWithHTTP2<youtube_v3.Schema$Video>[] = []

    for (const file of videoFiles) {
      const match = file.match(/part(\d+)/)
      const partNumber = match?.[1] ? parseInt(match[1], 10) : 0
      const videoPath = path.join(this.videosDir, file)

      const descEnPath = path.join(
        this.descriptionsDir,
        `${file.replace('.MTS', '')}-description_en.txt`,
      )
      let description = ''
      try {
        description = await Bun.file(descEnPath).text()
      } catch {
        batchLogger.warn({ file }, 'No English description found for %s', file)
      }

      const title = `Video Part ${partNumber}`

      uploadLogger.info({ file, title }, 'Uploading %s as "%s"...', file, title)
      const response = await this.uploadVideo(
        videoPath,
        title,
        description,
        this.options.categoryId || CATEGORY_ID,
        this.options.privacyStatus || PRIVACY_STATUS,
      )
      responses.push(response)
    }

    batchLogger.info('All uploads complete.')
    return responses
  }

  private async uploadVideoWithRetry(
    service: YouTubeService,
    videoPath: string,
    title: NonNullable<youtube_v3.Schema$VideoSnippet['title']>,
    description: NonNullable<youtube_v3.Schema$VideoSnippet['description']>,
    categoryId: NonNullable<youtube_v3.Schema$VideoSnippet['categoryId']>,
    privacyStatus: YouTubePrivacyStatus,
  ): Promise<GaxiosResponseWithHTTP2<youtube_v3.Schema$Video>> {
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        retryLogger.debug(
          { attempt: attempt + 1 },
          'Attempt %d: calling service.videos.insert',
          attempt + 1,
        )
        const response = await service.videos.insert({
          part: ['snippet', 'status'],
          requestBody: {
            snippet: {
              title,
              description,
              categoryId,
            },
            status: {
              privacyStatus,
            },
          },
          media: {
            body: fs.createReadStream(videoPath),
          },
        })

        // Check if the response indicates an error
        if (response.status >= 400) {
          throw new Error(
            `YouTube API error: ${response.status} ${response.statusText}`,
          )
        }

        return response
      } catch (error) {
        if (attempt < this.maxRetries) {
          const delay = this.retryDelay * 2 ** attempt
          retryLogger.warn(
            {
              delay,
              currentAttempt: attempt + 1,
              maxRetries: this.maxRetries,
            },
            'Upload failed, retrying in %dms... (%d/%d)',
            delay,
            attempt + 1,
            this.maxRetries,
          )
          await new Promise((resolve) => setTimeout(resolve, delay))
        } else {
          throw error
        }
      }
    }
    // This should never be reached due to the throw in the catch block above
    throw new Error('Failed to upload video')
  }

  private async uploadVideo(
    videoPath: string,
    title: NonNullable<youtube_v3.Schema$VideoSnippet['title']>,
    description: NonNullable<youtube_v3.Schema$VideoSnippet['description']>,
    categoryId: NonNullable<youtube_v3.Schema$VideoSnippet['categoryId']>,
    privacyStatus: YouTubePrivacyStatus,
    verify?: boolean,
  ): Promise<GaxiosResponseWithHTTP2<youtube_v3.Schema$Video>> {
    const service = google.youtube({
      version: 'v3',
      auth: await this.authenticator.getAuth(),
    })

    uploadLogger.debug('Calling service.videos.insert')
    const response = await this.uploadVideoWithRetry(
      service,
      videoPath,
      title,
      description,
      categoryId,
      privacyStatus,
    )

    const uploadedVideoId = response?.data.id || ''
    uploadLogger.info(
      { videoId: uploadedVideoId },
      'Video uploaded successfully: https://youtu.be/%s',
      uploadedVideoId,
    )

    if ((verify ?? this.options.verifyUploads ?? true) && uploadedVideoId) {
      const verifier = new YouTubeUploadVerifier(
        this.options.credentialsPath,
        this.options.tokenPath,
      )
      await verifier.verifyVideo(uploadedVideoId, {
        title,
        description,
        categoryId,
        privacyStatus,
      })
    }

    return response
  }
}
