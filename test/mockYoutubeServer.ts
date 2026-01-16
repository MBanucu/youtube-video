// test/mockYoutubeServer.ts
import type { youtube_v3 } from 'googleapis'

let server: ReturnType<typeof Bun.serve> | null = null
const uploadedVideos = new Map<string, youtube_v3.Schema$Video>()
const sessions = new Map<string, youtube_v3.Schema$Video>()
let insertFailureCount = 0

export async function startMockServer(port: number = 4000) {
  uploadedVideos.clear()
  sessions.clear()

  server = Bun.serve({
    port,
    async fetch(req) {
      const url = new URL(req.url)
      const pathname = url.pathname

      // Log for debugging tests
      console.log(`Received: ${req.method} ${req.url}`)

      // set-failures - POST /set-failures
      if (pathname === '/set-failures' && req.method === 'POST') {
        const body = (await req.json()) as { count?: number }
        insertFailureCount = body.count || 0
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
        console.log('List request id:', id, 'uploadedVideos keys:', [
          ...uploadedVideos.keys(),
        ])
        const items: youtube_v3.Schema$Video[] = []
        if (id) {
          const ids = id.split(',')
          for (const videoId of ids) {
            const video = uploadedVideos.get(videoId)
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
        console.log(
          'videos.insert, uploadType:',
          uploadType,
          'contentType:',
          contentType,
        )

        if (uploadType === 'resumable') {
          // Resumable initiate: read metadata JSON
          let metadata: Record<string, unknown> = {}
          try {
            metadata = (await req.json()) as Record<string, unknown>
            console.log('Resumable metadata:', metadata)
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
          sessions.set(sessionId, video)
          uploadedVideos.set(videoId, video)

          return new Response('', {
            status: 200,
            headers: {
              Location: `http://localhost:${port}/resumable/${sessionId}`,
            },
          })
        }

        if (uploadType === 'multipart') {
          // Handle configured failures
          if (insertFailureCount > 0) {
            insertFailureCount--
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
            uploadedVideos.set(videoId, video)
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
          console.log('Manual parsing, bodyText length:', bodyText.length)
          const parts = bodyText
            .split(boundary)
            .filter((p) => p.trim() && !p.includes('--'))
          console.log('Parts:', parts.length)
          let metadata: Record<string, unknown> = {}
          for (const part of parts) {
            console.log('Part header:', part.slice(0, 200))
            if (part.includes('application/json')) {
              const jsonStart = part.indexOf('\r\n\r\n') + 4
              const jsonStr = part
                .slice(jsonStart, part.lastIndexOf('\r\n--'))
                .trim()
              console.log('JSON str:', jsonStr)
              try {
                metadata = JSON.parse(jsonStr)
                console.log('Parsed metadata:', metadata)
              } catch (e) {
                console.log('Parse error:', e)
              }
            }
          }

          // Consume media part (ignored)
          const videoId = `multipart-${Date.now()}`
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
          console.log('Created video:', video.id, video.snippet?.title)
          uploadedVideos.set(videoId, video)

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

        const video = sessions.get(sessionId)
        if (!video) {
          return new Response('Session not found', { status: 404 })
        }

        console.log('PUT to resumable, returning video:', video)

        // Consume the media stream
        if (req.body) {
          const reader = req.body.getReader()
          while (!(await reader.read()).done) {
            // drain
          }
        }

        // Assume single-chunk upload (common for test files)
        sessions.delete(sessionId)
        return new Response(JSON.stringify(video), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      return new Response('Not Implemented', { status: 501 })
    },
  })

  console.log(`\n🚀 Mock YouTube API server running at ${server.url}\n`)
  return server
}

export function stopMockServer() {
  if (server) {
    server.stop(true)
    console.log('🛑 Mock YouTube API server stopped')
    server = null
  }
}
