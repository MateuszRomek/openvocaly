export const MANUAL_PASTE_ACCELERATOR = 'CommandOrControl+V'
export const NATIVE_PASTE_BINARY_NAME = 'macos-fast-paste'
export const NATIVE_PASTE_TIMEOUT_MS = 1_500

// Known aliases for this app process. Used to avoid auto-paste into our own focused window.
export const SELF_PROCESS_NAME_ALIASES = ['OpenVocaly'] as const

// AppleScript probe that inspects the frontmost accessibility element and reports:
// editable flag + process identity + focused role/subrole.
export const APPLE_SCRIPT_PROBE_EDITABLE_LINES = [
  'tell application "System Events"',
  'set frontProcess to first process whose frontmost is true',
  'set processName to (name of frontProcess) as text',
  'set processPid to (unix id of frontProcess) as text',
  'try',
  'set value of attribute "AXEnhancedUserInterface" of frontProcess to true',
  'end try',
  'set focusedElement to value of attribute "AXFocusedUIElement" of frontProcess',
  'if focusedElement is missing value then return "0\t" & processName & "\t" & processPid & "\t\t"',
  'set currentElement to focusedElement',
  'set currentRole to ""',
  'set currentSubrole to ""',
  'repeat 8 times',
  'try',
  'set editable to value of attribute "AXEditable" of currentElement',
  'if editable is true then return "1\t" & processName & "\t" & processPid & "\t" & currentRole & "\t" & currentSubrole',
  'end try',
  'try',
  'set roleValue to value of attribute "AXRole" of currentElement',
  'set currentRole to roleValue as text',
  'if roleValue is in {"AXTextField", "AXTextArea", "AXComboBox", "AXSearchField", "AXTextView"} then return "1\t" & processName & "\t" & processPid & "\t" & currentRole & "\t" & currentSubrole',
  'end try',
  'try',
  'set subroleValue to value of attribute "AXSubrole" of currentElement',
  'set currentSubrole to subroleValue as text',
  'if subroleValue is in {"AXSearchField", "AXTextField"} then return "1\t" & processName & "\t" & processPid & "\t" & currentRole & "\t" & currentSubrole',
  'end try',
  'try',
  'set currentElement to value of attribute "AXParent" of currentElement',
  'on error',
  'exit repeat',
  'end try',
  'if currentElement is missing value then exit repeat',
  'end repeat',
  'return "0\t" & processName & "\t" & processPid & "\t" & currentRole & "\t" & currentSubrole',
  'end tell'
] as const

// AppleScript fallback that sends Cmd+V through System Events when native helper is unavailable.
export const APPLE_SCRIPT_PASTE_LINES = [
  'tell application "System Events"',
  'keystroke "v" using command down',
  'end tell'
] as const
