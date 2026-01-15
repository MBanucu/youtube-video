// test/fakeGoogleServer.ts
// Fake YouTube server that stores uploaded videos and serves them via list API

import type { youtube_v3 } from 'googleapis'
import type { GaxiosResponseWithHTTP2 } from 'googleapis-common'

// Use actual YouTube API types
type VideoData = youtube_v3.Schema$Video

export class FakeGoogleServer {
  private videos = new Map<string, VideoData>()
  private insertFailureCount: number = 0

  // Configure how many insert calls should fail before succeeding
  setInsertFailures(count: number): void {
    this.insertFailureCount = count
  }

  // Simulate videos.insert
  async insert(
    params: youtube_v3.Params$Resource$Videos$Insert,
  ): Promise<GaxiosResponseWithHTTP2<youtube_v3.Schema$Video>> {
    // Handle configured failures
    if (this.insertFailureCount > 0) {
      this.insertFailureCount--
      throw new Error('Network error')
    }

    // Drain stream if present (like real YouTube API)
    if (params.media?.body) {
      await new Promise<void>((resolve, reject) => {
        params.media!.body.on('error', reject)
        params.media!.body.on('end', resolve)
        params.media!.body.resume()
      })
    }

    // Generate fake video ID
    const videoId = `fake-video-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    // Store video data
    const videoData: VideoData = {
      id: videoId,
      snippet: {
        title: params.requestBody?.snippet?.title || '',
        description: params.requestBody?.snippet?.description || '',
        categoryId: params.requestBody?.snippet?.categoryId || '',
      },
      status: {
        privacyStatus: params.requestBody?.status?.privacyStatus || 'private',
      },
    }

    this.videos.set(videoId, videoData)

    // Return a proper GaxiosResponseWithHTTP2-like object
    return {
      data: videoData,
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
      ok: true,
    } as GaxiosResponseWithHTTP2<youtube_v3.Schema$Video>
  }

  // Simulate videos.list
  // biome-ignore lint/suspicious/noExplicitAny: Mock implementation using any for flexibility
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

  getAllVideoIds(): string[] {
    return Array.from(this.videos.keys())
  }

  clear(): void {
    this.videos.clear()
  }
}

// Export a shared instance for concurrent testing
export const sharedFakeGoogleServer = new FakeGoogleServer()
