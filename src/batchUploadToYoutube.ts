import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import type { Credentials } from 'google-auth-library'
import { OAuth2Client } from 'google-auth-library'
import { google } from 'googleapis'
import { paths } from './paths'
import type { BatchUploadOptions, ClientCredentials } from './types'
import { YouTubeUploadVerifier } from './verifyYoutubeUpload'

// YouTube video category ID (22 = People & Blogs; adjust as needed, e.g., 28 for Science & Technology)
const CATEGORY_ID = '22'

// Default privacy status for uploaded videos
const PRIVACY_STATUS = 'private' // Options: 'public', 'private', 'unlisted'

// OAuth2 scopes for YouTube
const SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly',
]

export class YouTubeBatchUploader {
  private options: BatchUploadOptions
  private auth: OAuth2Client | null = null
  private videosDir: string
  private descriptionsDir: string
  private tokenPath: string
  private maxRetries: number
  private retryDelay: number

  constructor(options: BatchUploadOptions) {
    this.options = options
    this.videosDir = options.videosDir || paths.videosDir
    this.descriptionsDir = options.descriptionsDir || paths.descriptionsDir
    this.tokenPath =
      options.tokenPath ||
      path.join(path.dirname(options.credentialsPath), 'token.json')
    this.maxRetries = options.maxRetries ?? 3
    this.retryDelay = options.retryDelay ?? 1000
  }

  async authorize(credentials: ClientCredentials): Promise<OAuth2Client> {
    const clientSecret = credentials.installed.client_secret
    const clientId = credentials.installed.client_id
    const redirectUrl = credentials.installed.redirect_uris[0]
    const oauth2Client = new OAuth2Client(clientId, clientSecret, redirectUrl)

    try {
      const token = await Bun.file(this.tokenPath).text()
      oauth2Client.credentials = JSON.parse(token)
      return oauth2Client
    } catch (_err) {
      return this.getNewToken(oauth2Client)
    }
  }

  async getNewToken(oauth2Client: OAuth2Client): Promise<OAuth2Client> {
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
    })
    console.log('Authorize this app by visiting this url:', authUrl)
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    })
    const code = await new Promise<string>((resolve) => {
      rl.question('Enter the code from that page here: ', (code) => {
        rl.close()
        resolve(code)
      })
    })
    const token = await oauth2Client.getToken(code)
    oauth2Client.credentials = token.tokens
    await this.storeToken(token.tokens)
    return oauth2Client
  }

  async storeToken(token: Credentials): Promise<void> {
    await Bun.write(this.tokenPath, JSON.stringify(token))
  }

  async getAuth(): Promise<OAuth2Client> {
    const auth = this.auth
    if (!auth) {
      return await this.initializeAuth()
    }
    return auth
  }

  async initializeAuth(): Promise<OAuth2Client> {
    const content = await Bun.file(this.options.credentialsPath).text()
    const credentials = JSON.parse(content)
    const auth = await this.authorize(credentials)
    this.auth = auth
    return auth
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

  async uploadBatch(): Promise<void> {
    const videoFiles = await this.findVideoFiles()

    if (videoFiles.length === 0) {
      console.log('No split video files found in', this.videosDir)
      return
    }

    console.log(`Found ${videoFiles.length} video parts to upload.`)

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
        console.log(`Warning: No English description found for ${file}`)
      }

      const title = `Video Part ${partNumber}`

      console.log(`Uploading ${file} as "${title}"...`)
      await this.uploadVideo(
        videoPath,
        title,
        description,
        this.options.categoryId || CATEGORY_ID,
        this.options.privacyStatus || PRIVACY_STATUS,
      )
    }

    console.log('All uploads complete.')
  }

  private async uploadVideo(
    videoPath: string,
    title: string,
    description: string,
    categoryId: string,
    privacyStatus: string,
    verify?: boolean,
  ): Promise<{
    videoId: string
    title: string
    description: string
    categoryId: string
    privacyStatus: string
  }> {
    const service = google.youtube({
      version: 'v3',
      auth: await this.getAuth(),
    })

    // biome-ignore lint/suspicious/noExplicitAny: Google API response type is complex
    let response: any
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        response = await service.videos.insert({
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
        break
      } catch (error) {
        if (attempt < this.maxRetries) {
          const delay = this.retryDelay * 2 ** attempt
          console.log(
            `Upload failed, retrying in ${delay}ms... (${attempt + 1}/${this.maxRetries})`,
          )
          await new Promise((resolve) => setTimeout(resolve, delay))
        } else {
          throw error
        }
      }
    }

    const uploadedVideoId = response?.data.id || ''
    console.log(
      `Video uploaded successfully: https://youtu.be/${uploadedVideoId}`,
    )

    if ((verify ?? this.options.verifyUploads ?? true) && uploadedVideoId) {
      const verifier = new YouTubeUploadVerifier(await this.getAuth())
      await verifier.verifyVideo(uploadedVideoId, {
        title,
        description,
        categoryId,
        privacyStatus: privacyStatus as 'public' | 'private' | 'unlisted',
      })
    }

    return {
      videoId: uploadedVideoId,
      title,
      description,
      categoryId,
      privacyStatus,
    }
  }
}
