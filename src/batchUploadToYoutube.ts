import fs from 'node:fs'
import path from 'node:path'
import type { youtube_v3 } from 'googleapis'
import { google } from 'googleapis'
import type { GaxiosResponseWithHTTP2 } from 'googleapis-common'
import type { YouTubePrivacyStatus } from './types'

type YouTubeService = ReturnType<typeof google.youtube>

import { logger } from './logger'
import { paths } from './paths'
import type { BatchUploadOptions } from './types'
import { YouTubeUploadVerifier } from './verifyYoutubeUpload'
import { YouTubeAuthenticator } from './youtubeAuthenticator'

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
      logger.info('No split video files found in', this.videosDir)
      return []
    }

    logger.info(`Found ${videoFiles.length} video parts to upload.`)

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
        logger.warn(`No English description found for ${file}`)
      }

      const title = `Video Part ${partNumber}`

      logger.info(`Uploading ${file} as "${title}"...`)
      const response = await this.uploadVideo(
        videoPath,
        title,
        description,
        this.options.categoryId || CATEGORY_ID,
        this.options.privacyStatus || PRIVACY_STATUS,
      )
      responses.push(response)
    }

    logger.info('All uploads complete.')
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
        logger.debug(`Attempt ${attempt + 1}: calling service.videos.insert`)
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
          logger.warn(
            `Upload failed, retrying in ${delay}ms... (${attempt + 1}/${this.maxRetries})`,
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

    // Override URLs for testing
    const rootUrl =
      process.env['YOUTUBE_ROOT_URL'] || 'https://youtube.googleapis.com/'
    // Type assertion for internal googleapis service configuration
    const serviceWithOptions = service as youtube_v3.Youtube & {
      context?: { _options?: { rootUrl?: string; baseURL?: string } }
      _options?: { rootUrl?: string; baseURL?: string }
    }

    if (serviceWithOptions.context?._options) {
      serviceWithOptions.context._options.rootUrl = rootUrl
      serviceWithOptions.context._options.baseURL = `${rootUrl}youtube/v3/`
    }
    if (serviceWithOptions._options) {
      serviceWithOptions._options.rootUrl = rootUrl
      serviceWithOptions._options.baseURL = `${rootUrl}youtube/v3/`
    }

    logger.debug('Calling service.videos.insert')
    const response = await this.uploadVideoWithRetry(
      service,
      videoPath,
      title,
      description,
      categoryId,
      privacyStatus,
    )

    const uploadedVideoId = response?.data.id || ''
    logger.info(
      `Video uploaded successfully: https://youtu.be/${uploadedVideoId}`,
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
