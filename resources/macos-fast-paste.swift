import Cocoa

enum Command: String {
  case paste
  case probe
}

struct ProbePayload: Encodable {
  let ok: Bool
  let isEditable: Bool
  let frontProcessName: String?
  let frontProcessIdentifier: String?
  let frontProcessPath: String?
  let frontProcessPid: Int32?
  let focusedRole: String?
  let focusedSubrole: String?
  let message: String?
}

private let editableRoles: Set<String> = [
  "AXTextField",
  "AXTextArea",
  "AXComboBox",
  "AXSearchField",
  "AXTextView",
]

private let editableSubroles: Set<String> = [
  "AXSearchField",
  "AXTextField",
]

func main() {
  let command = resolveCommand()
  switch command {
  case .paste:
    runPaste()
  case .probe:
    runProbe()
  }
}

func resolveCommand() -> Command {
  if CommandLine.arguments.count <= 1 {
    return .paste
  }

  return Command(rawValue: CommandLine.arguments[1]) ?? .paste
}

func runPaste() {
  guard AXIsProcessTrusted() else {
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
}

func runProbe() {
  guard AXIsProcessTrusted() else {
    emitProbe(
      ProbePayload(
        ok: false,
        isEditable: false,
        frontProcessName: nil,
        frontProcessIdentifier: nil,
        frontProcessPath: nil,
        frontProcessPid: nil,
        focusedRole: nil,
        focusedSubrole: nil,
        message: "Accessibility not trusted."
      )
    )
    exit(2)
  }

  guard let frontApp = NSWorkspace.shared.frontmostApplication else {
    emitProbe(
      ProbePayload(
        ok: false,
        isEditable: false,
        frontProcessName: nil,
        frontProcessIdentifier: nil,
        frontProcessPath: nil,
        frontProcessPid: nil,
        focusedRole: nil,
        focusedSubrole: nil,
        message: "Unable to resolve frontmost application."
      )
    )
    exit(0)
  }

  let pid = frontApp.processIdentifier
  let appElement = AXUIElementCreateApplication(pid)

  if let focused = copyAXElementAttribute(appElement, kAXFocusedUIElementAttribute as CFString) {
    let inspected = inspectEditableTarget(start: focused)
    emitProbe(
      ProbePayload(
        ok: true,
        isEditable: inspected.isEditable,
        frontProcessName: frontApp.localizedName,
        frontProcessIdentifier: frontApp.bundleIdentifier,
        frontProcessPath: frontApp.bundleURL?.path,
        frontProcessPid: pid,
        focusedRole: inspected.role,
        focusedSubrole: inspected.subrole,
        message: nil
      )
    )
    exit(0)
  }

  emitProbe(
    ProbePayload(
      ok: true,
      isEditable: false,
      frontProcessName: frontApp.localizedName,
      frontProcessIdentifier: frontApp.bundleIdentifier,
      frontProcessPath: frontApp.bundleURL?.path,
      frontProcessPid: pid,
      focusedRole: nil,
      focusedSubrole: nil,
      message: nil
    )
  )
  exit(0)
}

func emitProbe(_ payload: ProbePayload) {
  let encoder = JSONEncoder()
  guard let data = try? encoder.encode(payload), let json = String(data: data, encoding: .utf8) else {
    fputs("{\"ok\":false,\"isEditable\":false,\"message\":\"Failed to encode probe payload.\"}\n", stderr)
    return
  }

  fputs("\(json)\n", stdout)
}

func inspectEditableTarget(start element: AXUIElement) -> (isEditable: Bool, role: String?, subrole: String?) {
  var currentElement: AXUIElement? = element
  var currentRole: String? = nil
  var currentSubrole: String? = nil

  for _ in 0..<8 {
    guard let element = currentElement else {
      break
    }

    if let role = copyAttribute(element, kAXRoleAttribute as CFString) as? String {
      currentRole = role
    }

    if let subrole = copyAttribute(element, kAXSubroleAttribute as CFString) as? String {
      currentSubrole = subrole
    }

    if let editable = copyAttribute(element, "AXEditable" as CFString) as? Bool, editable {
      return (true, currentRole, currentSubrole)
    }

    if let role = currentRole, editableRoles.contains(role) {
      return (true, currentRole, currentSubrole)
    }

    if let subrole = currentSubrole, editableSubroles.contains(subrole) {
      return (true, currentRole, currentSubrole)
    }

    currentElement = copyAXElementAttribute(element, kAXParentAttribute as CFString)
  }

  return (false, currentRole, currentSubrole)
}

func copyAttribute(_ element: AXUIElement, _ attribute: CFString) -> CFTypeRef? {
  var value: CFTypeRef?
  let error = AXUIElementCopyAttributeValue(element, attribute, &value)
  guard error == .success else {
    return nil
  }

  return value
}

func copyAXElementAttribute(_ element: AXUIElement, _ attribute: CFString) -> AXUIElement? {
  guard let value = copyAttribute(element, attribute) else {
    return nil
  }

  guard CFGetTypeID(value) == AXUIElementGetTypeID() else {
    return nil
  }

  return unsafeBitCast(value, to: AXUIElement.self)
}

main()
