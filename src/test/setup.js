import '@testing-library/jest-dom/vitest'
import { vi, beforeEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => cleanup())

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

Object.defineProperty(global.navigator, 'geolocation', {
  configurable: true,
  value: {
    getCurrentPosition: vi.fn(),
    watchPosition: vi.fn(),
    clearWatch: vi.fn(),
  },
})

const ctxMock = () => ({
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  imageSmoothingEnabled: false,
  set fillStyle(v) {},
  set strokeStyle(v) {},
  beginPath: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  stroke: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  closePath: vi.fn(),
  scale: vi.fn(),
})

beforeEach(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ctxMock())
})

global.fetch = vi.fn()
