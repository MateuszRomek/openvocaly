import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ shell: { openExternal: vi.fn() } }))

const { isExternalHttpUrl, isSameDocumentNavigation } = await import('./web-contents-security')

describe('isExternalHttpUrl', () => {
  it.each([
    ['https://github.com/MateuszRomek/openvocaly', true],
    ['http://example.com', true],
    ['file:///etc/passwd', false],
    ['x-apple.systempreferences:com.apple.preference.security', false],
    ['javascript:alert(1)', false],
    ['not a url', false]
  ])('%s -> %s', (url, expected) => {
    expect(isExternalHttpUrl(url)).toBe(expected)
  })
})

describe('isSameDocumentNavigation', () => {
  it('allows reloading the current dev document', () => {
    expect(
      isSameDocumentNavigation('http://localhost:5173/#/settings', 'http://localhost:5173/')
    ).toBe(true)
  })

  it('allows reloading the current packaged document', () => {
    expect(
      isSameDocumentNavigation(
        'file:///app/out/renderer/index.html#/',
        'file:///app/out/renderer/index.html'
      )
    ).toBe(true)
  })

  it.each([
    ['http://localhost:5173/', 'https://evil.example/'],
    ['file:///app/out/renderer/index.html', 'file:///etc/passwd'],
    ['file:///app/out/renderer/index.html', 'https://example.com/'],
    ['', 'https://example.com/']
  ])('denies %s -> %s', (current, target) => {
    expect(isSameDocumentNavigation(current, target)).toBe(false)
  })
})
