// test/batchUploadToYoutube.test.ts

import { expect, mock, test } from 'bun:test'
import * as batchUpload from '../src/batchUploadToYoutube'
import { paths } from '../src/paths'

// Mock console.log to capture output without printing
const consoleLogMock = mock(() => {})

test('main should authorize, find videos, and upload them with descriptions', async () => {
  // Mock console.log
  const originalConsoleLog = console.log
  console.log = consoleLogMock

  // Mock fs.promises.readFile for credentials and descriptions
  const fsPromisesReadFileMock = mock(async (filePath: string) => {
    if (filePath.endsWith('credentials.json')) {
      return JSON.stringify({
        installed: {
          client_id: 'fake-client-id',
          client_secret: 'fake-secret',
          redirect_uris: ['urn:ietf:wg:oauth:2.0:oob'],
        },
      })
    } else if (filePath.endsWith('-description_en.txt')) {
      return 'Fake description for testing'
    }
    return '{}' // Fallback
  })

  // Mock fs.promises.readdir to return fake video files
  const fsPromisesReaddirMock = mock(async () => ['part1.MTS', 'part2.MTS'])

  // Mock fs.promises.writeFile (for token storage, but since we mock authorize, may not be called)
  const fsPromisesWriteFileMock = mock(async () => {})

  // Override fs.promises
  mock.module('fs', () => ({
    promises: {
      readFile: fsPromisesReadFileMock,
      readdir: fsPromisesReaddirMock,
      writeFile: fsPromisesWriteFileMock,
    },
    createReadStream: mock(() => ({})), // Mock stream for media body
  }))

  // Mock path.join to control paths (optional, but for consistency)
  const pathJoinMock = mock((...args: string[]) => args.join('/'))
  mock.module('path', () => ({
    join: pathJoinMock,
  }))

  // Mock google.youtube service
  const insertMock = mock(async () => ({
    data: { id: 'fake-video-id' },
  }))
  const youtubeServiceMock = {
    videos: {
      insert: insertMock,
    },
  }
  const googleYoutubeMock = mock(() => youtubeServiceMock)


  mock.module('googleapis', () => ({
    google: {
      youtube: googleYoutubeMock,
    },
  }))

  // Call main
  await batchUpload.main()

  // Assertions
  expect(batchUpload.authorize).toHaveBeenCalledTimes(1)

  expect(fsPromisesReaddirMock).toHaveBeenCalledTimes(1)
  expect(fsPromisesReaddirMock).toHaveBeenCalledWith(paths.videosDir)

  expect(fsPromisesReadFileMock).toHaveBeenCalledWith(
    expect.stringContaining('credentials.json'),
    'utf8',
  )
  expect(fsPromisesReadFileMock).toHaveBeenCalledWith(
    expect.stringContaining('part1-description_en.txt'),
    'utf8',
  )
  expect(fsPromisesReadFileMock).toHaveBeenCalledWith(
    expect.stringContaining('part2-description_en.txt'),
    'utf8',
  )

  expect(googleYoutubeMock).toHaveBeenCalledTimes(2) // Once per video

  expect(insertMock).toHaveBeenCalledTimes(2)

  expect(consoleLogMock).toHaveBeenCalledWith('Found 2 video parts to upload.')
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

  // Restore original console.log
  console.log = originalConsoleLog
})
