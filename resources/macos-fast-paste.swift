import Cocoa

if !AXIsProcessTrusted() {
  exit(2)
}

guard let keyDown = CGEvent(keyboardEventSource: nil, virtualKey: 0x09, keyDown: true),
  let keyUp = CGEvent(keyboardEventSource: nil, virtualKey: 0x09, keyDown: false)
else {
  exit(1)
}

keyDown.flags = .maskCommand
keyUp.flags = .maskCommand
keyDown.post(tap: .cgSessionEventTap)
usleep(8_000) // 8ms between key down/up
keyUp.post(tap: .cgSessionEventTap)
usleep(20_000) // 20ms to let the paste event propagate
