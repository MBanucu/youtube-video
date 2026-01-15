// test/mock-interference-demo.test.ts
// Demonstrates mock interference in concurrent Bun tests
//
// Problem: mock.module() calls from different tests interfere with each other
// when running concurrently, because they modify the same global module registry.
//
// Solution: Move mocks inside test functions and avoid shared mock.module calls,
// or run problematic tests sequentially.
//
// Run with: bun test --concurrent test/mock-interference-demo.test.ts
// Expected: Test 3 fails because it gets 'mock2' instead of 'real value'

import { expect, mock, test } from 'bun:test'

// Test 1: Sets mock to return 'mock1'
test('test 1 - sets mock to mock1', async () => {
  const mock1 = mock(() => 'mock1')
  mock.module('./service.ts', () => ({ Service: { getValue: mock1 } }))

  const { Service } = await import('./service.ts')
  const result = Service.getValue()
  expect(result).toBe('mock1')
  console.log('Test 1 result:', result)
})

// Test 2: Sets mock to return 'mock2'
test('test 2 - sets mock to mock2', async () => {
  const mock2 = mock(() => 'mock2')
  mock.module('./service.ts', () => ({ Service: { getValue: mock2 } }))

  const { Service } = await import('./service.ts')
  const result = Service.getValue()
  expect(result).toBe('mock2')
  console.log('Test 2 result:', result)
})

// Test 3: Expects 'real value' but may get interfered mock
test('test 3 - expects real value but shows interference', async () => {
  // No mock set, should get real value
  const { Service } = await import('./service.ts')
  const result = Service.getValue()
  console.log('Test 3 result:', result)
  // Demonstrates interference: result may be 'mock2' instead of 'real value'
  // due to mock.module calls from concurrent tests affecting the same module
  expect(result).toBe('real value') // This will fail in concurrent execution
})
