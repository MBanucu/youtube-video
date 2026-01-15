// src/batchUploadToYoutube.ts

import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import type { Credentials } from 'google-auth-library'
import { OAuth2Client } from 'google-auth-library'
import { google } from 'googleapis'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { paths } from './paths' // Import centralized paths

const OAuth2 = OAuth2Client

interface Args {
  credentials: string
}

interface BatchUploadOptions {
  credentialsPath: string
  videosDir?: string
  descriptionsDir?: string
  tokenPath?: string
  categoryId?: string
  privacyStatus?: string
}

interface ClientCredentials {
  installed: {
    client_id: string
    client_secret: string
    redirect_uris: string[]
  }
}

// Scopes for YouTube upload access
const SCOPES = ['https://www.googleapis.com/auth/youtube.upload']

// Path to store the OAuth token (add to .gitignore if not already)
let TOKEN_PATH = path.join(process.cwd(), 'token.json')

// YouTube video category ID (22 = People & Blogs; adjust as needed, e.g., 28 for Science & Technology)
const CATEGORY_ID = '22'

// Default privacy status for uploaded videos
const PRIVACY_STATUS = 'private' // Options: 'public', 'private', 'unlisted'

/**
 * Create an OAuth2 client with the given credentials.
 * @param credentials The authorization client credentials.
 * @returns Promise resolving to the authorized OAuth2 client.
 */
export async function authorize(
  credentials: ClientCredentials,
): Promise<OAuth2Client> {
  const clientSecret = credentials.installed.client_secret
  const clientId = credentials.installed.client_id
  const redirectUrl = credentials.installed.redirect_uris[0]
  const oauth2Client = new OAuth2(clientId, clientSecret, redirectUrl)

  try {
    const token = await Bun.file(TOKEN_PATH).text()
    oauth2Client.credentials = JSON.parse(token)
    return oauth2Client
  } catch (_err) {
    return getNewToken(oauth2Client)
  }
}

/**
 * Get and store new token after prompting for user authorization.
 * @param oauth2Client The OAuth2 client to get token for.
 * @returns Promise resolving to the authorized OAuth2 client.
 */
export async function getNewToken(
  oauth2Client: OAuth2Client,
): Promise<OAuth2Client> {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  })
  console.log('Authorize this app by visiting this url:', authUrl)

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve, reject) => {
    rl.question('Enter the code from that page here: ', async (code) => {
      rl.close()
      try {
        const { tokens } = await oauth2Client.getToken(code)
        oauth2Client.credentials = tokens
        await storeToken(tokens)
        resolve(oauth2Client)
      } catch (err) {
        reject(err)
      }
    })
  })
}

/**
 * Store token to disk for later program executions.
 * @param token The token to store to disk.
 */
export async function storeToken(token: Credentials): Promise<void> {
  await Bun.write(TOKEN_PATH, JSON.stringify(token))
  console.log('Token stored to', TOKEN_PATH)
}

/**
 * Upload a single video to YouTube.
 * @param auth Authorized OAuth2 client.
 * @param videoPath Path to the video file.
 * @param title Video title.
 * @param description Video description.
 * @returns Promise resolving to the uploaded video ID.
 */
async function uploadVideo(
  auth: OAuth2Client,
  videoPath: string,
  title: string,
  description: string,
  categoryId: string,
  privacyStatus: string,
): Promise<string> {
  const service = google.youtube({ version: 'v3', auth })

  const response = await service.videos.insert({
    part: ['snippet', 'status'],
    requestBody: {
      snippet: {
        title,
        description,
        categoryId: categoryId,
        // tags: ['tag1', 'tag2'], // Add tags if needed
      },
      status: {
        privacyStatus: privacyStatus,
      },
    },
    media: {
      body: fs.createReadStream(videoPath),
    },
  })

  console.log(
    `Video uploaded successfully: https://youtu.be/${response.data.id}`,
  )
  return response.data.id || ''
}

/**
 * Class for batch uploading split videos to YouTube.
 */
export class YouTubeBatchUploader {
  private options: BatchUploadOptions
  private auth: OAuth2Client | null = null
  private videosDir: string
  private descriptionsDir: string
  private tokenPath: string

  constructor(options: BatchUploadOptions) {
    this.options = options
    this.videosDir = options.videosDir || paths.videosDir
    this.descriptionsDir = options.descriptionsDir || paths.descriptionsDir
    this.tokenPath =
      options.tokenPath ||
      path.join(path.dirname(options.credentialsPath), 'token.json')
    TOKEN_PATH = this.tokenPath
  }

  async initializeAuth() {
    const content = await Bun.file(this.options.credentialsPath).text()
    const credentials = JSON.parse(content)
    this.auth = await authorize(credentials)
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
    if (!this.auth) {
      await this.initializeAuth()
    }

    const videoFiles = await this.findVideoFiles()

    if (videoFiles.length === 0) {
      console.log('No split video files found in', this.videosDir)
      return
    }

    console.log(`Found ${videoFiles.length} video parts to upload.`)

    // Upload each video sequentially
    for (const file of videoFiles) {
      const match = file.match(/part(\d+)/)
      const partNumber = match?.[1] ? parseInt(match[1], 10) : 0
      const videoPath = path.join(this.videosDir, file)

      // Load English description (adjust if combining with DE)
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

      const title = `Video Part ${partNumber}` // Or use first line of description: description.split('\n')[0]

      console.log(`Uploading ${file} as "${title}"...`)
      // biome-ignore lint/style/noNonNullAssertion: auth is initialized above
      await uploadVideo(
        this.auth!,
        videoPath,
        title,
        description,
        this.options.categoryId || CATEGORY_ID,
        this.options.privacyStatus || PRIVACY_STATUS,
      )
    }

    console.log('All uploads complete.')
  }
}

/**
 * Batch upload split videos to YouTube.
 * @param options Configuration options for the upload
 * @deprecated Use YouTubeBatchUploader class instead
 */
export async function batchUploadToYoutube(options: BatchUploadOptions) {
  const uploader = new YouTubeBatchUploader(options)
  await uploader.uploadBatch()
}

/**
 * CLI entry point using yargs.
 */
async function main() {
  const argv = yargs(hideBin(process.argv))
    .option('credentials', {
      type: 'string',
      alias: 'c',
      description: 'Path to OAuth credentials.json file',
      default: './credentials.json',
      demandOption: false,
    })
    .option('videos-dir', {
      type: 'string',
      description: 'Directory containing video files',
    })
    .option('descriptions-dir', {
      type: 'string',
      description: 'Directory containing description files',
    }).argv as Args & { 'videos-dir'?: string; 'descriptions-dir'?: string }

  try {
    await batchUploadToYoutube({
      credentialsPath: argv.credentials,
      videosDir: argv['videos-dir'],
      descriptionsDir: argv['descriptions-dir'],
    })
  } catch (err) {
    console.error('Error:', err)
    process.exit(1)
  }
}

if (import.meta.main) {
  main()
}
