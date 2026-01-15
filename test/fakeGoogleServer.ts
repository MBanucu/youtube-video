// test/fakeGoogleServer.ts
// Fake YouTube server that stores uploaded videos and serves them via list API

interface VideoSnippet {
  title: string
  description: string
  categoryId: string
}

interface VideoStatus {
  privacyStatus: 'public' | 'private' | 'unlisted'
}

interface VideoData {
  id: string
  snippet: VideoSnippet
  status: VideoStatus
}

export class FakeGoogleServer {
  private videos = new Map<string, VideoData>()

  // Simulate videos.insert
  async insert(params: any): Promise<any> {
    // Drain stream if present (like real YouTube API)
    if (params.media?.body) {
      await new Promise((resolve, reject) => {
        params.media.body.on('error', reject)
        params.media.body.on('end', resolve)
        params.media.body.resume()
      })
    }

    // Generate fake video ID
    const videoId = `fake-video-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    // Store video data
    const videoData: VideoData = {
      id: videoId,
      snippet: {
        title: params.requestBody.snippet.title,
        description: params.requestBody.snippet.description,
        categoryId: params.requestBody.snippet.categoryId,
      },
      status: {
        privacyStatus: params.requestBody.status.privacyStatus,
      },
    }

    this.videos.set(videoId, videoData)

    return { data: { id: videoId } }
  }

  // Simulate videos.list
  async list(params: any): Promise<any> {
    const requestedIds = params.id || []
    const items: VideoData[] = []

    for (const id of requestedIds) {
      const video = this.videos.get(id)
      if (video) {
        items.push(video)
      }
    }

    return {
      data: {
        items,
      },
    }
  }

  // Utility methods for testing
  getVideo(videoId: string): VideoData | undefined {
    return this.videos.get(videoId)
  }

  getAllVideos(): VideoData[] {
    return Array.from(this.videos.values())
  }

  clear(): void {
    this.videos.clear()
  }
}
