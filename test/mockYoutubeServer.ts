// test/mockYoutubeServer.ts
import type { youtube_v3 } from 'googleapis'
import { logger } from '../src/logging'

// Use main logger from logging.ts

let server: ReturnType<typeof Bun.serve> | null = null

// State per port to support concurrent tests
const serverStates = new Map<
  number,
  {
    uploadedVideos: Map<string, youtube_v3.Schema$Video>
    sessions: Map<string, youtube_v3.Schema$Video>
    insertFailureCount: number
  }
>()

export async function startMockServer(port: number = 4000) {
  // Initialize state for this port
  const state = serverStates.get(port) || {
    uploadedVideos: new Map<string, youtube_v3.Schema$Video>(),
    sessions: new Map<string, youtube_v3.Schema$Video>(),
    insertFailureCount: 0,
  }
  state.uploadedVideos.clear()
  state.sessions.clear()
  state.insertFailureCount = 0
  serverStates.set(port, state)

  server = Bun.serve({
    port,
    async fetch(req) {
      const url = new URL(req.url)
      const pathname = url.pathname
      const state = serverStates.get(port)!

      // Log for debugging tests
      logger.debug(`Received: ${req.method} ${req.url}`)

      // set-failures - POST /set-failures
      if (pathname === '/set-failures' && req.method === 'POST') {
        const body = (await req.json()) as { count?: number }
        state.insertFailureCount = body.count || 0
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json' },
        })
      }

      // Remove or comment out discovery if not needed (since googleapis uses code-generated paths, not dynamic discovery)
      // discovery - GET /youtube/v3/discovery
      if (pathname === '/youtube/v3/discovery' && req.method === 'GET') {
        return new Response(
          JSON.stringify({
            kind: 'discovery#restDescription',
            discoveryVersion: 'v1',
            id: 'youtube:v3',
            name: 'youtube',
            version: 'v3',
            title: 'YouTube Data API',
            description: 'YouTube Data API',
            baseUrl: `http://localhost:${port}/youtube/v3/`,
            basePath: '/youtube/v3/',
            resources: {
              videos: {
                methods: {
                  insert: {
                    httpMethod: 'POST',
                    path: 'videos',
                    parameters: {
                      part: {
                        type: 'string',
                        required: true,
                        location: 'query',
                      },
                      uploadType: { type: 'string', location: 'query' },
                    },
                  },
                  list: {
                    httpMethod: 'GET',
                    path: 'videos',
                    parameters: {
                      part: {
                        type: 'string',
                        required: true,
                        location: 'query',
                      },
                      id: { type: 'string', location: 'query' },
                    },
                  },
                },
              },
            },
          }),
          {
            headers: { 'Content-Type': 'application/json' },
          },
        )
      }

      // videos.list - GET /youtube/v3/videos?part=...&id=...
      if (pathname === '/youtube/v3/videos' && req.method === 'GET') {
        const id = url.searchParams.get('id')
        logger.debug('List request id: {id}, uploadedVideos keys: {keys}', {
          id,
          keys: [...state.uploadedVideos.keys()],
        })
        const items: youtube_v3.Schema$Video[] = []
        if (id) {
          const ids = id.split(',')
          for (const videoId of ids) {
            const video = state.uploadedVideos.get(videoId)
            if (video) {
              items.push(video)
            }
          }
        }
        return new Response(
          JSON.stringify({
            kind: 'youtube#videoListResponse',
            items,
            etag: '"etag"',
            pageInfo: {
              totalResults: items.length,
              resultsPerPage: items.length,
            },
          }),
          {
            headers: { 'Content-Type': 'application/json' },
          },
        )
      }

      // videos.insert - POST /upload/youtube/v3/videos?uploadType=...
      if (pathname === '/upload/youtube/v3/videos' && req.method === 'POST') {
        const uploadType = url.searchParams.get('uploadType')
        const contentType = req.headers.get('content-type') || ''
        logger.debug(
          'videos.insert, uploadType: {uploadType}, contentType: {contentType}',
          {
            uploadType,
            contentType,
          },
        )

        if (uploadType === 'resumable') {
          // Resumable initiate: read metadata JSON
          let metadata: Record<string, unknown> = {}
          try {
            metadata = (await req.json()) as Record<string, unknown>
            logger.debug('Resumable metadata: {metadata}', { metadata })
          } catch {
            // fallback empty
          }

          const { snippet = {}, status = {} } = metadata as {
            snippet?: youtube_v3.Schema$VideoSnippet
            status?: youtube_v3.Schema$VideoStatus
          }
          const videoId = `yt-${crypto.randomUUID()}`

          const video: youtube_v3.Schema$Video = {
            kind: 'youtube#video',
            id: videoId,
            snippet: {
              title: snippet.title || 'Mock Title',
              description: snippet.description || 'Mock Description',
              categoryId: snippet.categoryId || '22',
            },
            status: {
              privacyStatus: status.privacyStatus || 'private',
            },
          }

          const sessionId = crypto.randomUUID()
          state.sessions.set(sessionId, video)
          state.uploadedVideos.set(videoId, video)

          return new Response('', {
            status: 200,
            headers: {
              Location: `http://localhost:${port}/resumable/${sessionId}`,
            },
          })
        }

        if (uploadType === 'multipart') {
          // Handle configured failures
          if (state.insertFailureCount > 0) {
            state.insertFailureCount--
            return new Response(
              JSON.stringify({
                error: {
                  code: 500,
                  message: 'Network error',
                  errors: [
                    {
                      domain: 'global',
                      reason: 'internalError',
                      message: 'Network error',
                    },
                  ],
                },
              }),
              {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
              },
            )
          }

          // Basic multipart handling for small files
          const contentType = req.headers.get('content-type') || ''
          if (contentType.includes('application/json')) {
            // Simple JSON body
            const metadata = (await req.json()) as youtube_v3.Schema$Video
            const videoId = `json-${Date.now()}`
            const video: youtube_v3.Schema$Video = {
              kind: 'youtube#video',
              id: videoId,
              snippet: metadata.snippet || {
                title: 'Mock Title',
                description: 'Mock Description',
                categoryId: '22',
              },
              status: metadata.status || { privacyStatus: 'private' },
            }
            state.uploadedVideos.set(videoId, video)
            return new Response(JSON.stringify(video), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            })
          }
        }

        const boundaryMatch = contentType.match(/boundary=(.+)/)
        if (boundaryMatch?.[1]) {
          const boundary = `--${boundaryMatch[1].replace(/"/g, '')}`
          const bodyText = await req.text()
          logger.debug('Manual parsing, bodyText length: {length}', {
            length: bodyText.length,
          })
          const parts = bodyText
            .split(boundary)
            .filter((p) => p.trim() && !p.includes('--'))
          logger.debug('Parts: {count}', { count: parts.length })
          let metadata: Record<string, unknown> = {}
          for (const part of parts) {
            logger.debug('Part header: {header}', {
              header: part.slice(0, 200),
            })
            if (part.includes('application/json')) {
              const jsonStart = part.indexOf('\r\n\r\n') + 4
              const jsonStr = part
                .slice(jsonStart, part.lastIndexOf('\r\n--'))
                .trim()
              logger.debug('JSON str: {jsonStr}', { jsonStr })
              try {
                metadata = JSON.parse(jsonStr)
                logger.debug('Parsed metadata: {metadata}', { metadata })
              } catch (e) {
                logger.debug('Parse error: {error}', { error: e })
              }
            }
          }

          // Consume media part (ignored)
          const videoId = `multipart-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
          const video: youtube_v3.Schema$Video = {
            kind: 'youtube#video',
            id: videoId,
            snippet: (metadata[
              'snippet'
            ] as youtube_v3.Schema$VideoSnippet) || {
              title: 'Mock Title',
              description: 'Mock Description',
              categoryId: '22',
            },
            status: (metadata['status'] as youtube_v3.Schema$VideoStatus) || {
              privacyStatus: 'private',
            },
          }
          logger.debug('Created video: {id}, title: {title}', {
            id: video.id,
            title: video.snippet?.title,
          })
          state.uploadedVideos.set(videoId, video)

          return new Response(JSON.stringify(video), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        }
      }

      // Resumable upload PUT to Location URL
      if (pathname.startsWith('/resumable/') && req.method === 'PUT') {
        const sessionId = pathname.split('/').pop()
        if (!sessionId) {
          return new Response('Invalid session ID', { status: 400 })
        }

        const video = state.sessions.get(sessionId)
        if (!video) {
          return new Response('Session not found', { status: 404 })
        }

        logger.debug('PUT to resumable, returning video: {video}', { video })

        // Consume the media stream
        if (req.body) {
          const reader = req.body.getReader()
          while (!(await reader.read()).done) {
            // drain
          }
        }

        // Assume single-chunk upload (common for test files)
        state.sessions.delete(sessionId)
        return new Response(JSON.stringify(video), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      return new Response('Not Implemented', { status: 501 })
    },
  })

  logger.info(
    { url: server.url },
    'Mock YouTube API server running at %s',
    server.url,
  )
  return server
}

export function stopMockServer(port: number = 4000) {
  if (server) {
    server.stop(true)
    logger.info('Mock YouTube API server stopped')
    server = null
    // Clean up state for this port
    serverStates.delete(port)
  }
}
