import { clipboard, nativeImage, type Data } from 'electron'

type ClipboardBufferEntry = {
  format: string
  data: Buffer
}

type ClipboardSnapshot = {
  entries: ClipboardBufferEntry[]
  text: string
  html: string
  rtf: string
  bookmarkTitle: string
  bookmarkUrl: string
  imagePng: Buffer | null
}

/**
 * Captures and restores clipboard buffers exactly as they were before dictation paste flow.
 */
export class ClipboardTransaction {
  private snapshot: ClipboardSnapshot | null = null

  capture(): void {
    const formats = clipboard.availableFormats('clipboard')
    const entries: ClipboardBufferEntry[] = []

    for (const format of formats) {
      try {
        entries.push({
          format,
          data: clipboard.readBuffer(format)
        })
      } catch (error) {
        console.warn('[paste] failed to read clipboard format', { format, error })
      }
    }

    const bookmark = clipboard.readBookmark()
    const image = clipboard.readImage('clipboard')

    this.snapshot = {
      entries,
      text: clipboard.readText('clipboard'),
      html: clipboard.readHTML('clipboard'),
      rtf: clipboard.readRTF('clipboard'),
      bookmarkTitle: bookmark.title,
      bookmarkUrl: bookmark.url,
      imagePng: image.isEmpty() ? null : image.toPNG()
    }
  }

  writeText(text: string): void {
    clipboard.writeText(text)
  }

  restore(): void {
    if (!this.snapshot) {
      return
    }

    const snapshot = this.snapshot
    let restored = false

    const writePayload: Data = {}
    if (snapshot.text) {
      writePayload.text = snapshot.text
    }
    if (snapshot.html) {
      writePayload.html = snapshot.html
    }
    if (snapshot.rtf) {
      writePayload.rtf = snapshot.rtf
    }
    if (snapshot.imagePng) {
      writePayload.image = nativeImage.createFromBuffer(snapshot.imagePng)
    }
    if (snapshot.bookmarkTitle) {
      writePayload.bookmark = snapshot.bookmarkTitle
    }

    const hasStructuredPayload =
      Boolean(writePayload.text || writePayload.html || writePayload.rtf || writePayload.image) ||
      Boolean(snapshot.bookmarkUrl)

    if (hasStructuredPayload) {
      try {
        clipboard.clear()

        if (Object.keys(writePayload).length > 0) {
          clipboard.write(writePayload)
        }

        if (snapshot.bookmarkUrl) {
          clipboard.writeBookmark(
            snapshot.bookmarkTitle || snapshot.bookmarkUrl,
            snapshot.bookmarkUrl
          )
        }

        restored = true
      } catch (error) {
        console.warn('[paste] failed to restore structured clipboard snapshot', { error })
      }
    }

    if (!restored && snapshot.entries.length > 0) {
      let wroteAnyBuffer = false

      for (const entry of snapshot.entries) {
        try {
          if (!wroteAnyBuffer) {
            clipboard.clear()
          }

          clipboard.writeBuffer(entry.format, entry.data)
          wroteAnyBuffer = true
        } catch (error) {
          console.warn('[paste] failed to restore clipboard format', {
            format: entry.format,
            error
          })
        }
      }

      restored = wroteAnyBuffer
    }

    if (!restored) {
      console.warn(
        '[paste] clipboard snapshot restore skipped: no restorable formats were captured'
      )
    }

    this.snapshot = null
  }
}
