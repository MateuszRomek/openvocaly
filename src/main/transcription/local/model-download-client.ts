import { createHash } from 'node:crypto'
import { once } from 'node:events'
import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

export type DownloadFileOptions = {
  signal: AbortSignal
  onProgress?: (downloadedBytes: number, totalBytes: number) => void
}

const toErrorMessage = (responseText: string, status: number): string => {
  const compactText = responseText.trim().slice(0, 160)
  if (!compactText.length) {
    return `Model download failed with status ${status}.`
  }
  return `Model download failed with status ${status}: ${compactText}`
}

export const hashFileSha256 = async (filePath: string): Promise<string> =>
  await new Promise<string>((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(filePath)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.once('error', reject)
    stream.once('end', () => resolve(hash.digest('hex')))
  })

export const downloadFile = async (
  sourceUrl: string,
  destinationPath: string,
  options: DownloadFileOptions
): Promise<void> => {
  const response = await fetch(sourceUrl, {
    method: 'GET',
    redirect: 'follow',
    signal: options.signal
  })

  if (!response.ok) {
    const responseText = await response.text().catch(() => '')
    throw new Error(toErrorMessage(responseText, response.status))
  }

  if (!response.body) {
    throw new Error('Model download failed: empty response body.')
  }

  // Create the full directory tree for the target path if it does not exist yet.
  await mkdir(dirname(destinationPath), { recursive: true })
  const fileStream = createWriteStream(destinationPath)
  const reader = response.body.getReader()

  const totalBytesHeader = response.headers.get('content-length')
  const totalBytes = totalBytesHeader ? Number(totalBytesHeader) : 0
  let downloadedBytes = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        break
      }

      if (!value) {
        continue
      }

      downloadedBytes += value.byteLength
      options.onProgress?.(downloadedBytes, totalBytes)

      const writable = fileStream.write(Buffer.from(value))
      if (!writable) {
        await once(fileStream, 'drain')
      }
    }

    fileStream.end()
    await once(fileStream, 'finish')

    // fetch decodes compressed bodies, so content-length only counts bytes for identity encoding.
    const isIdentityEncoded = !response.headers.get('content-encoding')
    if (isIdentityEncoded && totalBytes > 0 && downloadedBytes !== totalBytes) {
      throw new Error(
        `Model download was truncated: received ${downloadedBytes} of ${totalBytes} bytes.`
      )
    }
  } catch (error) {
    fileStream.destroy()
    throw error
  } finally {
    reader.releaseLock()
  }
}
