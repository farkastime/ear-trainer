import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'

// RTL's own auto-cleanup only registers when `afterEach` is global, which this
// project's vitest config does not enable.
afterEach(cleanup)
