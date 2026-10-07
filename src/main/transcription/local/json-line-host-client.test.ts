import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'
import { HOST_IDLE_UNLOAD_MS, JsonLineHostClient, type HostReply } from './json-line-host-client'

// A serial fake host: every reply carries its pid and the commands it has received.
// A request whose filePath is "slow" takes 300 ms, like an in-flight inference.
const FAKE_HOST_SOURCE = `#!${process.execPath}
const readline = require('node:readline')
const commands = []
let queue = Promise.resolve()
readline.createInterface({ input: process.stdin }).on('line', (line) => {
  const request = JSON.parse(line)
  queue = queue.then(async () => {
    commands.push(request.command)
    if (request.filePath === 'slow') await new Promise((resolve) => setTimeout(resolve, 300))
    process.stdout.write(JSON.stringify({ id: request.id, ok: true, text: process.pid + ':' + commands.join(',') }) + '\\n')
  })
})
`

const fixtureDir = mkdtempSync(join(tmpdir(), 'openvocaly-host-test-'))
const fakeHostPath = join(fixtureDir, 'fake-host')
writeFileSync(fakeHostPath, FAKE_HOST_SOURCE)
chmodSync(fakeHostPath, 0o755)

type FakeReply = HostReply & { text: string }

const clients: Array<JsonLineHostClient<FakeReply>> = []
const createClient = (): JsonLineHostClient<FakeReply> => {
  const client = new JsonLineHostClient<FakeReply>({
    label: 'fake host',
    resolveBinaryPath: () => fakeHostPath,
    missingBinaryMessage: 'missing'
  })
  clients.push(client)
  return client
}

const parseReply = (reply: FakeReply): { pid: string; commands: string[] } => {
  const [pid, commands] = reply.text.split(':')
  return { pid, commands: commands.split(',') }
}

afterEach(async () => {
  vi.useRealTimers()
  await Promise.all(clients.splice(0).map((client) => client.stop()))
})

afterAll(() => {
  rmSync(fixtureDir, { recursive: true, force: true })
})

describe('JsonLineHostClient', () => {
  it('keeps the warm process when a request is cancelled and drops its late reply', async () => {
    const client = createClient()
    const first = parseReply(await client.request('warm', {}, { timeoutMs: 5000 }))

    const controller = new AbortController()
    const cancelled = client.request(
      'transcribe',
      { filePath: 'slow' },
      { timeoutMs: 5000, signal: controller.signal }
    )
    await new Promise<void>((resolve) => setTimeout(resolve, 50))
    controller.abort()
    await expect(cancelled).rejects.toThrow('fake host transcribe command cancelled.')

    const next = parseReply(await client.request('transcribe', {}, { timeoutMs: 5000 }))
    expect(next.pid).toBe(first.pid)
    expect(next.commands).toEqual(['warm', 'transcribe', 'transcribe'])
  })

  it('rejects only the stopped process requests when a new process starts during stop', async () => {
    const client = createClient()
    const stale = client.request('transcribe', { filePath: 'slow' }, { timeoutMs: 5000 })
    await new Promise<void>((resolve) => setTimeout(resolve, 100))

    const stopping = client.stop()
    const fresh = client.request('transcribe', { filePath: 'slow' }, { timeoutMs: 5000 })

    await expect(stale).rejects.toThrow(/fake host exited/)
    await stopping
    expect(parseReply(await fresh).commands).toEqual(['transcribe'])
  })

  it('unloads the model after the idle period without killing the process', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const client = createClient()
    const warm = parseReply(await client.request('warm', {}, { timeoutMs: 5000 }))

    vi.advanceTimersByTime(HOST_IDLE_UNLOAD_MS)
    vi.useRealTimers()

    await vi.waitFor(async () => {
      const probe = parseReply(await client.request('transcribe', {}, { timeoutMs: 5000 }))
      expect(probe.pid).toBe(warm.pid)
      expect(probe.commands.slice(0, 2)).toEqual(['warm', 'unload'])
    })
  })
})
