#include "ptt_hook.h"

#import <AppKit/AppKit.h>
#import <ApplicationServices/ApplicationServices.h>
#import <Foundation/Foundation.h>

#include <atomic>
#include <chrono>
#include <condition_variable>
#include <cstdint>
#include <mutex>
#include <string>
#include <thread>

namespace {

struct PttBinding {
  int32_t keyCode;
  bool cmd;
  bool ctrl;
  bool alt;
  bool shift;
};

enum class PttHoldState {
  kIdle,
  kHolding,
};

struct NativePttEvent {
  bool isStart;
};

napi_threadsafe_function g_tsfn = nullptr;
std::thread g_hookThread;
std::atomic<bool> g_isRunning(false);
std::atomic<bool> g_isListening(false);

CFMachPortRef g_eventTap = nullptr;
CFRunLoopSourceRef g_runLoopSource = nullptr;
CFRunLoopRef g_runLoop = nullptr;

std::mutex g_startMutex;
std::condition_variable g_startCv;
bool g_startReady = false;
bool g_startOk = false;
std::string g_startError;

std::mutex g_bindingMutex;
PttBinding g_binding = { .keyCode = 0, .cmd = false, .ctrl = false, .alt = false, .shift = false };
bool g_bindingConfigured = false;
PttHoldState g_holdState = PttHoldState::kIdle;

void CleanupTapResources() {
  if (g_eventTap != nullptr) {
    CGEventTapEnable(g_eventTap, false);
  }

  if (g_runLoop != nullptr && g_runLoopSource != nullptr) {
    CFRunLoopRemoveSource(g_runLoop, g_runLoopSource, kCFRunLoopCommonModes);
  }

  if (g_runLoopSource != nullptr) {
    CFRelease(g_runLoopSource);
    g_runLoopSource = nullptr;
  }

  if (g_eventTap != nullptr) {
    CFMachPortInvalidate(g_eventTap);
    CFRelease(g_eventTap);
    g_eventTap = nullptr;
  }

  if (g_runLoop != nullptr) {
    CFRelease(g_runLoop);
    g_runLoop = nullptr;
  }
}

void ResolveStartState(bool ok, const std::string& errorMessage) {
  std::lock_guard<std::mutex> guard(g_startMutex);
  g_startReady = true;
  g_startOk = ok;
  g_startError = errorMessage;
  g_startCv.notify_all();
}

bool DoModifiersMatchBinding(CGEventFlags flags, const PttBinding& binding) {
  const bool cmd = static_cast<bool>(flags & kCGEventFlagMaskCommand);
  const bool ctrl = static_cast<bool>(flags & kCGEventFlagMaskControl);
  const bool alt = static_cast<bool>(flags & kCGEventFlagMaskAlternate);
  const bool shift = static_cast<bool>(flags & kCGEventFlagMaskShift);

  return
    cmd == binding.cmd &&
    ctrl == binding.ctrl &&
    alt == binding.alt &&
    shift == binding.shift;
}

void EmitPttEvent(bool isStart) {
  if (g_tsfn == nullptr) {
    return;
  }

  const auto* eventData = new NativePttEvent{ .isStart = isStart };
  const napi_status status =
    napi_call_threadsafe_function(g_tsfn, const_cast<NativePttEvent*>(eventData), napi_tsfn_nonblocking);

  if (status != napi_ok) {
    delete eventData;
  }
}

CGEventRef HandleKeyboardEvent(CGEventTapProxy, CGEventType type, CGEventRef event, void*) {
  if (g_tsfn == nullptr) {
    return event;
  }

  if (type != kCGEventKeyDown && type != kCGEventKeyUp) {
    return event;
  }

  const int32_t keyCode = static_cast<int32_t>(
    CGEventGetIntegerValueField(event, kCGKeyboardEventKeycode)
  );

  if (type == kCGEventKeyDown) {
    const bool isRepeat = static_cast<bool>(
      CGEventGetIntegerValueField(event, kCGKeyboardEventAutorepeat)
    );

    bool shouldEmitStart = false;

    {
      std::lock_guard<std::mutex> guard(g_bindingMutex);

      if (!g_bindingConfigured) {
        return event;
      }

      if (g_binding.keyCode != keyCode) {
        return event;
      }

      if (isRepeat) {
        return event;
      }

      if (!DoModifiersMatchBinding(CGEventGetFlags(event), g_binding)) {
        return event;
      }

      if (g_holdState == PttHoldState::kIdle) {
        g_holdState = PttHoldState::kHolding;
        shouldEmitStart = true;
      }
    }

    if (shouldEmitStart) {
      EmitPttEvent(true);
    }

    return event;
  }

  bool shouldEmitStop = false;

  {
    std::lock_guard<std::mutex> guard(g_bindingMutex);

    if (!g_bindingConfigured) {
      return event;
    }

    if (g_holdState != PttHoldState::kHolding) {
      return event;
    }

    if (g_binding.keyCode != keyCode) {
      return event;
    }

    g_holdState = PttHoldState::kIdle;
    shouldEmitStop = true;
  }

  if (shouldEmitStop) {
    EmitPttEvent(false);
  }

  return event;
}

void CallJavaScript(
  napi_env env,
  napi_value jsCallback,
  void*,
  void* data
) {
  auto* eventData = static_cast<NativePttEvent*>(data);

  if (env == nullptr || jsCallback == nullptr || eventData == nullptr) {
    delete eventData;
    return;
  }

  napi_value eventObject;
  napi_create_object(env, &eventObject);

  napi_value typeValue;
  napi_create_string_utf8(
    env,
    eventData->isStart ? "push_to_talk_start" : "push_to_talk_stop",
    NAPI_AUTO_LENGTH,
    &typeValue
  );
  napi_set_named_property(env, eventObject, "type", typeValue);

  napi_value undefinedValue;
  napi_get_undefined(env, &undefinedValue);

  napi_value args[1] = { eventObject };
  napi_call_function(env, undefinedValue, jsCallback, 1, args, nullptr);

  delete eventData;
}

void HookThreadMain() {
  const auto eventMask =
    (1 << kCGEventKeyDown) |
    (1 << kCGEventKeyUp);

  g_eventTap = CGEventTapCreate(
    kCGSessionEventTap,
    kCGHeadInsertEventTap,
    kCGEventTapOptionListenOnly,
    eventMask,
    HandleKeyboardEvent,
    nullptr
  );

  if (g_eventTap == nullptr) {
    g_isRunning = false;
    g_isListening = false;
    ResolveStartState(false, "Failed to create CGEventTap");
    return;
  }

  g_runLoopSource = CFMachPortCreateRunLoopSource(kCFAllocatorDefault, g_eventTap, 0);
  if (g_runLoopSource == nullptr) {
    CleanupTapResources();
    g_isRunning = false;
    g_isListening = false;
    ResolveStartState(false, "Failed to create run loop source");
    return;
  }

  g_runLoop = CFRunLoopGetCurrent();
  CFRetain(g_runLoop);
  CFRunLoopAddSource(g_runLoop, g_runLoopSource, kCFRunLoopCommonModes);
  CGEventTapEnable(g_eventTap, true);

  {
    std::lock_guard<std::mutex> guard(g_bindingMutex);
    g_holdState = PttHoldState::kIdle;
  }

  g_isRunning = true;
  g_isListening = true;
  ResolveStartState(true, "");

  CFRunLoopRun();

  CleanupTapResources();
  g_isRunning = false;
  g_isListening = false;

  {
    std::lock_guard<std::mutex> guard(g_bindingMutex);
    g_holdState = PttHoldState::kIdle;
  }
}

napi_value MakeResult(napi_env env, bool ok, const std::string& error) {
  napi_value result;
  napi_create_object(env, &result);

  napi_value okValue;
  napi_get_boolean(env, ok, &okValue);
  napi_set_named_property(env, result, "ok", okValue);

  if (!ok) {
    napi_value errorValue;
    napi_create_string_utf8(env, error.c_str(), NAPI_AUTO_LENGTH, &errorValue);
    napi_set_named_property(env, result, "error", errorValue);
  }

  return result;
}

void ReleaseThreadsafeFunction() {
  if (g_tsfn == nullptr) {
    return;
  }

  napi_release_threadsafe_function(g_tsfn, napi_tsfn_release);
  g_tsfn = nullptr;
}

bool ReadBooleanProperty(
  napi_env env,
  napi_value object,
  const char* name,
  bool* out,
  std::string* error
) {
  napi_value value;
  if (napi_get_named_property(env, object, name, &value) != napi_ok) {
    *error = std::string("Missing modifiers.") + name + " value";
    return false;
  }

  napi_valuetype type;
  if (napi_typeof(env, value, &type) != napi_ok || type != napi_boolean) {
    *error = std::string("Modifier ") + name + " must be a boolean";
    return false;
  }

  bool parsed = false;
  if (napi_get_value_bool(env, value, &parsed) != napi_ok) {
    *error = std::string("Failed to read modifier ") + name;
    return false;
  }

  *out = parsed;
  return true;
}

bool ParseBinding(
  napi_env env,
  napi_value value,
  PttBinding* binding,
  std::string* error
) {
  napi_valuetype valueType;
  if (napi_typeof(env, value, &valueType) != napi_ok || valueType != napi_object) {
    *error = "Binding must be an object";
    return false;
  }

  napi_value keyCodeValue;
  if (napi_get_named_property(env, value, "keyCode", &keyCodeValue) != napi_ok) {
    *error = "Binding keyCode is required";
    return false;
  }

  napi_valuetype keyCodeType;
  if (napi_typeof(env, keyCodeValue, &keyCodeType) != napi_ok || keyCodeType != napi_number) {
    *error = "Binding keyCode must be a number";
    return false;
  }

  int32_t keyCode = 0;
  if (napi_get_value_int32(env, keyCodeValue, &keyCode) != napi_ok) {
    *error = "Binding keyCode must be an int32";
    return false;
  }

  napi_value modifiersValue;
  if (napi_get_named_property(env, value, "modifiers", &modifiersValue) != napi_ok) {
    *error = "Binding modifiers are required";
    return false;
  }

  napi_valuetype modifiersType;
  if (napi_typeof(env, modifiersValue, &modifiersType) != napi_ok || modifiersType != napi_object) {
    *error = "Binding modifiers must be an object";
    return false;
  }

  bool cmd = false;
  bool ctrl = false;
  bool alt = false;
  bool shift = false;

  if (
    !ReadBooleanProperty(env, modifiersValue, "cmd", &cmd, error) ||
    !ReadBooleanProperty(env, modifiersValue, "ctrl", &ctrl, error) ||
    !ReadBooleanProperty(env, modifiersValue, "alt", &alt, error) ||
    !ReadBooleanProperty(env, modifiersValue, "shift", &shift, error)
  ) {
    return false;
  }

  *binding = {
    .keyCode = keyCode,
    .cmd = cmd,
    .ctrl = ctrl,
    .alt = alt,
    .shift = shift,
  };

  return true;
}

napi_value StartHook(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value args[1];
  napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);

  if (argc < 1) {
    return MakeResult(env, false, "Listener callback is required");
  }

  napi_valuetype type;
  napi_typeof(env, args[0], &type);
  if (type != napi_function) {
    return MakeResult(env, false, "Listener callback must be a function");
  }

  if (g_isListening.load()) {
    return MakeResult(env, true, "");
  }

  ReleaseThreadsafeFunction();

  napi_value asyncResourceName;
  napi_create_string_utf8(env, "pttHookListener", NAPI_AUTO_LENGTH, &asyncResourceName);

  napi_status tsfnStatus = napi_create_threadsafe_function(
    env,
    args[0],
    nullptr,
    asyncResourceName,
    0,
    1,
    nullptr,
    nullptr,
    nullptr,
    CallJavaScript,
    &g_tsfn
  );

  if (tsfnStatus != napi_ok) {
    g_tsfn = nullptr;
    return MakeResult(env, false, "Failed to create thread-safe callback");
  }

  {
    std::lock_guard<std::mutex> guard(g_startMutex);
    g_startReady = false;
    g_startOk = false;
    g_startError.clear();
  }

  if (g_hookThread.joinable()) {
    g_hookThread.join();
  }

  g_hookThread = std::thread(HookThreadMain);

  std::unique_lock<std::mutex> lock(g_startMutex);
  const bool ready = g_startCv.wait_for(lock, std::chrono::seconds(2), [] {
    return g_startReady;
  });

  if (!ready) {
    if (g_runLoop != nullptr) {
      CFRunLoopStop(g_runLoop);
    }
    lock.unlock();
    if (g_hookThread.joinable()) {
      g_hookThread.join();
    }
    ReleaseThreadsafeFunction();
    return MakeResult(env, false, "Timed out while starting native hook");
  }

  if (!g_startOk) {
    const std::string error = g_startError;
    lock.unlock();
    if (g_hookThread.joinable()) {
      g_hookThread.join();
    }
    ReleaseThreadsafeFunction();
    return MakeResult(env, false, error);
  }

  return MakeResult(env, true, "");
}

napi_value StopHook(napi_env env, napi_callback_info) {
  if (g_isRunning.load() && g_runLoop != nullptr) {
    CFRunLoopStop(g_runLoop);
  }

  if (g_hookThread.joinable()) {
    g_hookThread.join();
  }

  {
    std::lock_guard<std::mutex> guard(g_bindingMutex);
    g_holdState = PttHoldState::kIdle;
  }

  ReleaseThreadsafeFunction();

  napi_value undefinedValue;
  napi_get_undefined(env, &undefinedValue);
  return undefinedValue;
}

napi_value SetBinding(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value args[1];
  napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);

  if (argc < 1) {
    return MakeResult(env, false, "Binding object is required");
  }

  std::string parseError;
  PttBinding parsedBinding;

  if (!ParseBinding(env, args[0], &parsedBinding, &parseError)) {
    return MakeResult(env, false, parseError);
  }

  {
    std::lock_guard<std::mutex> guard(g_bindingMutex);
    g_binding = parsedBinding;
    g_bindingConfigured = true;
    g_holdState = PttHoldState::kIdle;
  }

  return MakeResult(env, true, "");
}

napi_value ClearBinding(napi_env env, napi_callback_info) {
  {
    std::lock_guard<std::mutex> guard(g_bindingMutex);
    g_bindingConfigured = false;
    g_holdState = PttHoldState::kIdle;
  }

  napi_value undefinedValue;
  napi_get_undefined(env, &undefinedValue);
  return undefinedValue;
}

napi_value IsAccessibilityGranted(napi_env env, napi_callback_info) {
  napi_value result;
  napi_get_boolean(env, AXIsProcessTrusted(), &result);
  return result;
}

napi_value RequestAccessibilityPrompt(napi_env env, napi_callback_info) {
  NSDictionary* options = @{(__bridge id)kAXTrustedCheckOptionPrompt : @YES};
  const bool granted = AXIsProcessTrustedWithOptions((__bridge CFDictionaryRef)options);

  napi_value result;
  napi_get_boolean(env, granted, &result);
  return result;
}

napi_value OpenAccessibilitySettings(napi_env env, napi_callback_info) {
  NSURL* url = [NSURL
    URLWithString:@"x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"];
  const bool opened = [[NSWorkspace sharedWorkspace] openURL:url];

  napi_value result;
  napi_get_boolean(env, opened, &result);
  return result;
}

} // namespace

napi_value Init(napi_env env, napi_value exports) {
  napi_property_descriptor descriptors[] = {
    { "start", nullptr, StartHook, nullptr, nullptr, nullptr, napi_default, nullptr },
    { "stop", nullptr, StopHook, nullptr, nullptr, nullptr, napi_default, nullptr },
    { "setBinding", nullptr, SetBinding, nullptr, nullptr, nullptr, napi_default, nullptr },
    { "clearBinding", nullptr, ClearBinding, nullptr, nullptr, nullptr, napi_default, nullptr },
    { "isAccessibilityGranted", nullptr, IsAccessibilityGranted, nullptr, nullptr, nullptr, napi_default, nullptr },
    { "requestAccessibilityPrompt", nullptr, RequestAccessibilityPrompt, nullptr, nullptr, nullptr, napi_default, nullptr },
    { "openAccessibilitySettings", nullptr, OpenAccessibilitySettings, nullptr, nullptr, nullptr, napi_default, nullptr }
  };

  napi_define_properties(env, exports, sizeof(descriptors) / sizeof(descriptors[0]), descriptors);
  return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)
