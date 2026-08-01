import { describe, it, expect } from 'vitest'
import { THEMES, applyTheme, ACCENTS } from '../lib/theme.js'

describe('theme', () => {
  it('applies light theme', () => {
    applyTheme('light', 'blue')
    const root = document.documentElement
    expect(root.style.getPropertyValue('--text')).toBeTruthy()
    expect(root.style.getPropertyValue('--accent')).toBe('#007aff')
  })

  it('applies dark theme and accent', () => {
    applyTheme('dark', 'pink')
    const root = document.documentElement
    expect(root.style.getPropertyValue('--accent')).toBe('#ff2d55')
    expect(root.style.colorScheme).toBe('dark')
  })

  it('has all expected themes', () => {
    expect(Object.keys(THEMES)).toEqual(expect.arrayContaining(['auto', 'light', 'dark', 'midnight', 'rose', 'ocean']))
    expect(Object.keys(ACCENTS).length).toBeGreaterThanOrEqual(6)
  })
})
