import { expect, mock, test } from 'bun:test'

// Test 1: Global mock (defined at module level)
const globalMock = mock(async (id: string) => `global-${id}`)
mock.module('./mock-target.ts', () => ({
  TestService: { getData: globalMock },
}))

test('test with global mock', async () => {
  const { TestService } = await import('./mock-target.ts')
  const result = await TestService.getData('test1')
  expect(result).toBe('global-test1')
  expect(globalMock).toHaveBeenCalledWith('test1')
})

// Test 2: Local mock (defined inside test)
test('test with local mock', async () => {
  const localMock = mock(async (id: string) => `local-${id}`)
  mock.module('./mock-target.ts', () => ({
    TestService: { getData: localMock },
  }))

  const { TestService } = await import('./mock-target.ts')
  const result = await TestService.getData('test2')
  expect(result).toBe('local-test2')
  expect(localMock).toHaveBeenCalledWith('test2')
})

// Test 3: Console.log mocking interference demonstration
const sharedConsoleMock = mock(() => {})

test('test console.log shared mock - first', async () => {
  console.log = sharedConsoleMock

  console.log('first test message')
  expect(sharedConsoleMock).toHaveBeenCalledWith('first test message')

  // Don't restore here to demonstrate interference
})

test('test console.log shared mock - second', async () => {
  const originalLog = console.log
  console.log = sharedConsoleMock

  console.log('second test message')
  expect(sharedConsoleMock).toHaveBeenCalledWith('second test message')

  // Restore at the end
  console.log = originalLog
})

// Test 4: Proper isolated console.log mocking
test('test console.log isolated mock', async () => {
  const consoleMock = mock(() => {})
  const originalLog = console.log
  console.log = consoleMock

  console.log('isolated test message')
  expect(consoleMock).toHaveBeenCalledWith('isolated test message')

  // Restore
  console.log = originalLog
})
