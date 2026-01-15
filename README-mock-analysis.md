# Bun Mock Concurrent Execution Analysis

This branch contains a minimal working example to analyze how Bun's mock system behaves with concurrent test execution (`bun test --concurrent`).

## Key Findings

1. **Module mocks work reliably**: Using `mock.module()` with local mocks per test function prevents interference between concurrent tests.

2. **Global mocks can cause issues**: When mocks are defined at module level and shared across tests, they may interfere in concurrent execution.

3. **Console.log mocking conflicts**: Globally overriding `console.log` in multiple tests running concurrently can cause unpredictable behavior, as the global console object is shared.

4. **Isolation is key**: Each test should define its own mocks locally to ensure complete isolation during concurrent execution.

## Test Cases Demonstrated

- **Global vs Local Module Mocks**: Shows how local mocks prevent interference
- **Console Mocking Issues**: Demonstrates potential conflicts with global state mocking
- **Isolated Mocking**: Best practices for concurrent test execution

## Recommendations

- Always define mocks inside test functions when using concurrent execution
- Avoid global state mocking (like console.log) in concurrent tests
- Use local mock instances per test to ensure isolation
- Consider the execution order and timing when tests share global resources