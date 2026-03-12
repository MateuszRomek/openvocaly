export const MANUAL_PASTE_ACCELERATOR = 'CommandOrControl+V'
export const NATIVE_PASTE_BINARY_NAME = 'macos-fast-paste'
export const NATIVE_PASTE_TIMEOUT_MS = 1_500
export const NATIVE_PROBE_TIMEOUT_MS = 120
export const NATIVE_FIRST_PROBE_TIMEOUT_MS = 600
export const NATIVE_FIRST_PROBE_RETRY_TIMEOUT_MS = 1_500

// AppleScript probe that inspects the frontmost accessibility element and reports:
// editable flag + process identity + focused role/subrole + bundle id + path.

export const APPLE_SCRIPT_PROBE_EDITABLE_LINES = [
  'tell application "System Events"',
  'set frontProcess to first process whose frontmost is true',
  'set processName to (name of frontProcess) as text',
  'set processPid to (unix id of frontProcess) as text',
  'set bundleId to ""',
  'set appPath to ""',
  'try',
  'set bundleId to (bundle identifier of frontProcess) as text',
  'end try',
  'try',
  'set appPath to POSIX path of (file of frontProcess)',
  'end try',
  'try',
  'set value of attribute "AXEnhancedUserInterface" of frontProcess to true',
  'end try',
  'set focusedElement to value of attribute "AXFocusedUIElement" of frontProcess',
  'if focusedElement is missing value then return "0\t" & processName & "\t" & processPid & "\t\t\t" & bundleId & "\t" & appPath',
  'set currentElement to focusedElement',
  'set focusedRole to ""',
  'set focusedSubrole to ""',
  'set currentRole to ""',
  'set currentSubrole to ""',
  'set depth to 0',
  'repeat 8 times',
  'try',
  'set roleValue to value of attribute "AXRole" of currentElement',
  'set currentRole to roleValue as text',
  'if depth is 0 then set focusedRole to currentRole',
  'end try',
  'try',
  'set subroleValue to value of attribute "AXSubrole" of currentElement',
  'set currentSubrole to subroleValue as text',
  'if depth is 0 then set focusedSubrole to currentSubrole',
  'end try',
  'try',
  'set editable to value of attribute "AXEditable" of currentElement',
  'if editable is true then return "1\t" & processName & "\t" & processPid & "\t" & focusedRole & "\t" & focusedSubrole & "\t" & bundleId & "\t" & appPath',
  'end try',
  'if depth is 0 then',
  'if currentRole is in {"AXTextField", "AXTextArea", "AXComboBox", "AXSearchField", "AXTextView"} then return "1\t" & processName & "\t" & processPid & "\t" & focusedRole & "\t" & focusedSubrole & "\t" & bundleId & "\t" & appPath',
  'if currentSubrole is in {"AXSearchField", "AXTextField"} then return "1\t" & processName & "\t" & processPid & "\t" & focusedRole & "\t" & focusedSubrole & "\t" & bundleId & "\t" & appPath',
  'end if',
  'set depth to depth + 1',
  'try',
  'set currentElement to value of attribute "AXParent" of currentElement',
  'on error',
  'exit repeat',
  'end try',
  'if currentElement is missing value then exit repeat',
  'end repeat',
  'return "0\t" & processName & "\t" & processPid & "\t" & focusedRole & "\t" & focusedSubrole & "\t" & bundleId & "\t" & appPath',
  'end tell'
] as const

// AppleScript fallback that sends Cmd+V through System Events when native helper is unavailable.
export const APPLE_SCRIPT_PASTE_LINES = [
  'tell application "System Events"',
  'keystroke "v" using command down',
  'end tell'
] as const
