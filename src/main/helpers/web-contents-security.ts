import { shell, type WebContents } from 'electron'

const parseUrl = (url: string): URL | null => {
  try {
    return new URL(url)
  } catch {
    return null
  }
}

export const isExternalHttpUrl = (url: string): boolean => {
  const protocol = parseUrl(url)?.protocol
  return protocol === 'http:' || protocol === 'https:'
}

export const isSameDocumentNavigation = (currentUrl: string, targetUrl: string): boolean => {
  const current = parseUrl(currentUrl)
  const target = parseUrl(targetUrl)
  if (!current || !target) {
    return false
  }
  return (
    current.protocol === target.protocol &&
    current.host === target.host &&
    current.pathname === target.pathname
  )
}

export const hardenWebContents = (contents: WebContents): void => {
  contents.setWindowOpenHandler(({ url }) => {
    if (isExternalHttpUrl(url)) {
      void shell.openExternal(url).catch(() => undefined)
    }
    return { action: 'deny' }
  })

  contents.on('will-navigate', (event, url) => {
    if (!isSameDocumentNavigation(contents.getURL(), url)) {
      event.preventDefault()
    }
  })
}
