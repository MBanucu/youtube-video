// test/utils.ts - Test utilities and helpers

import { test } from 'bun:test'

/**
 * Conditional test execution for performance-heavy tests.
 * Uses test.concurrent in CI for parallel execution, test.skip locally to avoid slow tests.
 */
export const runHeavyTest = process.env['CI'] ? test.concurrent : test.skip
