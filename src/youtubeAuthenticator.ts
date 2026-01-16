// src/youtubeAuthenticator.ts

import path from 'node:path'
import readline from 'node:readline'
import type { Credentials } from 'google-auth-library'
import { OAuth2Client } from 'google-auth-library'
import { logger } from './logger'
import type { ClientCredentials } from './types'

// OAuth2 scopes for YouTube
const SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly',
]

export class YouTubeAuthenticator {
  private credentialsPath?: string
  private tokenPath?: string
  private auth: OAuth2Client | null = null
  private preconfiguredAuth?: OAuth2Client

  constructor(credentialsPath: string, tokenPath?: string)
  constructor(auth: OAuth2Client)
  constructor(
    credentialsPathOrAuth: string | OAuth2Client,
    tokenPath?: string,
  ) {
    if (typeof credentialsPathOrAuth === 'string') {
      this.credentialsPath = credentialsPathOrAuth
      this.tokenPath =
        tokenPath ||
        path.join(path.dirname(credentialsPathOrAuth), 'token.json')
    } else {
      this.preconfiguredAuth = credentialsPathOrAuth
    }
  }

  async getAuth(): Promise<OAuth2Client> {
    if (this.preconfiguredAuth) {
      return this.preconfiguredAuth
    }

    if (this.auth) {
      return this.auth
    }

    if (!this.credentialsPath) {
      throw new Error('YouTubeAuthenticator not properly initialized')
    }

    const content = await Bun.file(this.credentialsPath).text()
    const credentials = JSON.parse(content)
    this.auth = await this.authorize(credentials)
    return this.auth
  }

  private async authorize(
    credentials: ClientCredentials,
  ): Promise<OAuth2Client> {
    const clientSecret = credentials.installed.client_secret
    const clientId = credentials.installed.client_id
    const redirectUrl = credentials.installed.redirect_uris[0]
    const oauth2Client = new OAuth2Client(clientId, clientSecret, redirectUrl)

    try {
      if (!this.tokenPath) {
        throw new Error('Token path not set')
      }
      const token = await Bun.file(this.tokenPath).text()
      oauth2Client.credentials = JSON.parse(token)
      return oauth2Client
    } catch (_err) {
      return this.getNewToken(oauth2Client)
    }
  }

  private async getNewToken(oauth2Client: OAuth2Client): Promise<OAuth2Client> {
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
    })
    logger.info('Authorize this app by visiting this url:', authUrl)
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

  private async storeToken(token: Credentials): Promise<void> {
    if (!this.tokenPath) {
      throw new Error('Token path not set')
    }
    await Bun.write(this.tokenPath, JSON.stringify(token))
  }
}
