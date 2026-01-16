// test/mockYoutubeServer.ts
let server: ReturnType<typeof Bun.serve> | null = null
const uploadedVideos = new Map<string, any>()
const sessions = new Map<string, any>()

export async function startMockServer(port: number = 4000) {
  uploadedVideos.clear()
  sessions.clear()

  server = Bun.serve({
    port,
    async fetch(req) {
      const url = new URL(req.url)
      const pathname = url.pathname

      // Log for debugging tests
      console.log(`${req.method} ${pathname}${url.search}`)

      // videos.list - GET /youtube/v3/videos?part=...&id=...
      if (pathname === '/youtube/v3/videos' && req.method === 'GET') {
        const id = url.searchParams.get('id')
        if (id && uploadedVideos.has(id)) {
          const video = uploadedVideos.get(id)
          return new Response(
            JSON.stringify({
              kind: 'youtube#videoListResponse',
              items: [video],
            }),
            {
              headers: { 'Content-Type': 'application/json' },
            },
          )
        }
        return new Response(
          JSON.stringify({ error: { message: 'Video not found' } }),
          { status: 404 },
        )
      }

      // videos.insert - POST /upload/youtube/v3/videos?uploadType=...
      if (pathname === '/upload/youtube/v3/videos' && req.method === 'POST') {
        const uploadType = url.searchParams.get('uploadType')

        if (uploadType === 'resumable') {
          // Resumable initiate: read metadata JSON
          let metadata: any = {}
          try {
            metadata = await req.json()
          } catch {
            // fallback empty
          }

          const { snippet = {}, status = {} } = metadata as any
          const videoId = `yt-${crypto.randomUUID()}`

          const video = {
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
          // Basic multipart handling for small files
          const contentType = req.headers.get('content-type') || ''
          const boundaryMatch = contentType.match(/boundary=(.+)/)
          if (boundaryMatch && boundaryMatch[1]) {
            const boundary = '--' + boundaryMatch[1].replace(/"/g, '')
            const bodyText = await req.text()
            const parts = bodyText
              .split(boundary)
              .filter((p) => p.trim() && !p.includes('--'))

            let metadata: any = {}
            for (const part of parts) {
              if (part.includes('application/json')) {
                const jsonStart = part.indexOf('\r\n\r\n') + 4
                const jsonStr = part
                  .slice(jsonStart, part.lastIndexOf('\r\n--'))
                  .trim()
                try {
                  metadata = JSON.parse(jsonStr)
                } catch {}
              }
            }

            // Consume media part (ignored)
            const videoId = `multipart-${Date.now()}`
            const video = {
              kind: 'youtube#video',
              id: videoId,
              snippet: metadata.snippet || {},
              status: metadata.status || { privacyStatus: 'private' },
            }
            uploadedVideos.set(videoId, video)

            return new Response(JSON.stringify(video), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            })
          }
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
