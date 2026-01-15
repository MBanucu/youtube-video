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
 * Batch upload split videos to YouTube.
 * @param options Configuration options for the upload
 */
export async function batchUploadToYoutube(options: BatchUploadOptions) {
  const credentialsPath = options.credentialsPath
  const tokenPath =
    options.tokenPath || path.join(path.dirname(credentialsPath), 'token.json')
  TOKEN_PATH = tokenPath

  const videosDir = options.videosDir || paths.videosDir
  const descriptionsDir = options.descriptionsDir || paths.descriptionsDir

  // Load client secrets from credentials.json
  const content = await Bun.file(credentialsPath).text()
  const credentials = JSON.parse(content)

  // Authorize the client
  const auth = await authorize(credentials)

  // Find all partX.MTS files
  const files = await fs.promises.readdir(videosDir)
  const videoFiles = files
    .filter((f) => f.startsWith('part') && f.endsWith('.MTS'))
    .sort((a, b) => {
      const matchA = a.match(/part(\d+)/)
      const matchB = b.match(/part(\d+)/)
      const numA = matchA?.[1] ? parseInt(matchA[1], 10) : 0
      const numB = matchB?.[1] ? parseInt(matchB[1], 10) : 0
      return numA - numB
    })

  if (videoFiles.length === 0) {
    console.log('No split video files found in', videosDir)
    return
  }

  console.log(`Found ${videoFiles.length} video parts to upload.`)

  // Upload each video sequentially
  for (const file of videoFiles) {
    const match = file.match(/part(\d+)/)
    const partNumber = match?.[1] ? parseInt(match[1], 10) : 0
    const videoPath = path.join(videosDir, file)

    // Load English description (adjust if combining with DE)
    const descEnPath = path.join(
      descriptionsDir,
      `part${partNumber}-description_en.txt`,
    )
    let description = ''
    try {
      description = await Bun.file(descEnPath).text()
    } catch (_err) {
      console.error(
        `Description file not found for part ${partNumber}:`,
        descEnPath,
      )
      continue
    }

    // Optional: Load and append German description
    // const descDePath = path.join(descriptionsDir, `part${partNumber}-description_de.txt`);
    // try {
    //   const descDe = await fs.promises.readFile(descDePath, 'utf8');
    //   description += `\n\nGerman Version:\n${descDe}`;
    // } catch (err) {
    //   console.warn(`German description not found for part ${partNumber}`);
    // }

    // Set title (customize as needed, e.g., extract from description)
    const title = `Video Part ${partNumber}` // Or use first line of description: description.split('\n')[0]

    console.log(`Uploading ${file} as "${title}"...`)
    await uploadVideo(
      auth,
      videoPath,
      title,
      description,
      options.categoryId || CATEGORY_ID,
      options.privacyStatus || PRIVACY_STATUS,
    )
  }

  console.log('All uploads complete.')
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
