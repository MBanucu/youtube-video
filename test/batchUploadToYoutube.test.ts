// test/batchUploadToYoutube.test.ts

import { expect, mock, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Mock console.log to capture output without printing
const consoleLogMock = mock(() => {})

// Mock fs.promises.writeFile
const fsPromisesWriteFileMock = mock(async () => {})

// Mock google.youtube service
// biome-ignore lint/suspicious/noExplicitAny: any allows flexible mocking of stream body
const insertMock = mock(async (params: { media?: { body?: any } }) => {
  const { media } = params
  if (media?.body) {
    // Drain the stream to simulate consumption and ensure file closure
    await new Promise((resolve, reject) => {
      media.body.on('error', reject)
      media.body.on('end', resolve)
      media.body.resume() // Start flowing data to trigger 'end'
    })
  }
  return { data: { id: 'fake-video-id' } }
})
const youtubeServiceMock = {
  videos: {
    insert: insertMock,
  },
}
const googleYoutubeMock = mock(() => youtubeServiceMock)

// Mock OAuth2Client
const OAuth2ClientMock = mock(
  (_clientId: string, _clientSecret: string, _redirectUri: string) => ({
    setCredentials: mock(() => {}),
    credentials: {},
  }),
)

// Import will be done inside the test

test('main should authorize, find videos, and upload them with descriptions', async () => {
  // Create temp dir and fake files
  const tempDir = mkdtempSync(join(tmpdir(), 'youtube-test-'))
  const credentialsPath = join(tempDir, 'credentials.json')
  const tokenPath = join(tempDir, 'token.json')
  const fakeVideosDir = join(tempDir, 'videos')
  const fakeDescriptionsDir = join(tempDir, 'descriptions')

  // Create temp subdirs
  mkdirSync(fakeVideosDir)
  mkdirSync(fakeDescriptionsDir)

  // Create fake video files
  writeFileSync(join(fakeVideosDir, 'part1.MTS'), '')
  writeFileSync(join(fakeVideosDir, 'part2.MTS'), '')

  // Create fake description files
  writeFileSync(
    join(fakeDescriptionsDir, 'part1-description_en.txt'),
    'Fake description for testing',
  )
  writeFileSync(
    join(fakeDescriptionsDir, 'part2-description_en.txt'),
    'Fake description for testing',
  )

  writeFileSync(
    credentialsPath,
    JSON.stringify(
      {
        installed: {
          client_id: 'fake-client-id',
          client_secret: 'fake-secret',
          redirect_uris: ['urn:ietf:wg:oauth:2.0:oob'],
        },
      },
      null,
      2,
    ),
  )

  writeFileSync(
    tokenPath,
    JSON.stringify(
      {
        access_token: 'fake-access-token',
        refresh_token: 'fake-refresh-token',
        expiry_date: Date.now() + 3600000, // Valid in future
      },
      null,
      2,
    ),
  )

  // Override process.argv to pass --credentials
  const originalArgv = process.argv
  process.argv = (process.argv as string[])
    .slice(0, 2)
    .concat(['--credentials', credentialsPath])

  // Mock console.log
  const originalConsoleLog = console.log
  console.log = consoleLogMock

  // Mock paths to use temp dirs
  mock.module('../src/paths', () => ({
    paths: {
      videosDir: fakeVideosDir,
      descriptionsDir: fakeDescriptionsDir,
    },
  }))

  // Mock fs.promises
  mock.module('node:fs', () => ({
    promises: {
      writeFile: fsPromisesWriteFileMock,
    },
    createReadStream: mock(() => ({})), // Mock stream for media body
  }))

  mock.module('googleapis', () => ({
    google: {
      youtube: googleYoutubeMock,
    },
  }))

  mock.module('google-auth-library', () => ({
    OAuth2Client: OAuth2ClientMock,
  }))

  // Import after mocks
  const { main } = await import('../src/batchUploadToYoutube')

  try {
    // Call main
    await main()

    // Assertions
    expect(consoleLogMock).toHaveBeenCalledWith(
      'Found 2 video parts to upload.',
    )
    expect(consoleLogMock).toHaveBeenCalledWith(
      'Uploading part1.MTS as "Video Part 1"...',
    )
    expect(consoleLogMock).toHaveBeenCalledWith(
      'Video uploaded successfully: https://youtu.be/fake-video-id',
    )
    expect(consoleLogMock).toHaveBeenCalledWith(
      'Uploading part2.MTS as "Video Part 2"...',
    )
    expect(consoleLogMock).toHaveBeenCalledWith(
      'Video uploaded successfully: https://youtu.be/fake-video-id',
    )
    expect(consoleLogMock).toHaveBeenCalledWith('All uploads complete.')
  } finally {
    // Cleanup
    process.argv = originalArgv
    console.log = originalConsoleLog
    rmSync(tempDir, { recursive: true, force: true })
  }
})
