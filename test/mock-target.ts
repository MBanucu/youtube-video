// Mock target module for testing
export class TestService {
  static async getData(id: string): Promise<string> {
    return `data-${id}`
  }
}
