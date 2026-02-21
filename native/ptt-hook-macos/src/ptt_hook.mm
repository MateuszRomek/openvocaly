#include "ptt_hook.h"

#import <AppKit/AppKit.h>
#import <ApplicationServices/ApplicationServices.h>
#import <Foundation/Foundation.h>

#include <atomic>
#include <chrono>
#include <condition_variable>
#include <mutex>
#include <string>
#include <thread>

namespace {

struct NativeKeyEvent {
  bool isKeyDown;
  int32_t keyCode;
  bool cmd;
  bool ctrl;
  bool alt;
  bool shift;
  bool isRepeat;
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

CGEventRef HandleKeyboardEvent(CGEventTapProxy, CGEventType type, CGEventRef event, void*) {
  if (g_tsfn == nullptr) {
    return event;
  }

  if (type != kCGEventKeyDown && type != kCGEventKeyUp) {
    return event;
  }

  const auto* eventData = new NativeKeyEvent{
    .isKeyDown = type == kCGEventKeyDown,
    .keyCode = static_cast<int32_t>(
      CGEventGetIntegerValueField(event, kCGKeyboardEventKeycode)
    ),
    .cmd = static_cast<bool>(CGEventGetFlags(event) & kCGEventFlagMaskCommand),
    .ctrl = static_cast<bool>(CGEventGetFlags(event) & kCGEventFlagMaskControl),
    .alt = static_cast<bool>(CGEventGetFlags(event) & kCGEventFlagMaskAlternate),
    .shift = static_cast<bool>(CGEventGetFlags(event) & kCGEventFlagMaskShift),
    .isRepeat = static_cast<bool>(CGEventGetIntegerValueField(event, kCGKeyboardEventAutorepeat))
  };

  napi_call_threadsafe_function(g_tsfn, const_cast<NativeKeyEvent*>(eventData), napi_tsfn_nonblocking);
  return event;
}

void CallJavaScript(
  napi_env env,
  napi_value jsCallback,
  void*,
  void* data
) {
  auto* eventData = static_cast<NativeKeyEvent*>(data);

  if (env == nullptr || jsCallback == nullptr || eventData == nullptr) {
    delete eventData;
    return;
  }

  napi_value eventObject;
  napi_create_object(env, &eventObject);

  napi_value typeValue;
  napi_create_string_utf8(
    env,
    eventData->isKeyDown ? "keydown" : "keyup",
    NAPI_AUTO_LENGTH,
    &typeValue
  );
  napi_set_named_property(env, eventObject, "type", typeValue);

  napi_value keyCodeValue;
  napi_create_int32(env, eventData->keyCode, &keyCodeValue);
  napi_set_named_property(env, eventObject, "keyCode", keyCodeValue);

  napi_value modifiers;
  napi_create_object(env, &modifiers);

  napi_value cmd;
  napi_get_boolean(env, eventData->cmd, &cmd);
  napi_set_named_property(env, modifiers, "cmd", cmd);

  napi_value ctrl;
  napi_get_boolean(env, eventData->ctrl, &ctrl);
  napi_set_named_property(env, modifiers, "ctrl", ctrl);

  napi_value alt;
  napi_get_boolean(env, eventData->alt, &alt);
  napi_set_named_property(env, modifiers, "alt", alt);

  napi_value shift;
  napi_get_boolean(env, eventData->shift, &shift);
  napi_set_named_property(env, modifiers, "shift", shift);

  napi_set_named_property(env, eventObject, "modifiers", modifiers);

  napi_value repeat;
  napi_get_boolean(env, eventData->isRepeat, &repeat);
  napi_set_named_property(env, eventObject, "isRepeat", repeat);

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
    kCGEventTapOptionDefault,
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

  g_isRunning = true;
  g_isListening = true;
  ResolveStartState(true, "");

  CFRunLoopRun();

  CleanupTapResources();
  g_isRunning = false;
  g_isListening = false;
}

napi_value MakeStartResult(napi_env env, bool ok, const std::string& error) {
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

napi_value StartHook(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value args[1];
  napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);

  if (argc < 1) {
    return MakeStartResult(env, false, "Listener callback is required");
  }

  napi_valuetype type;
  napi_typeof(env, args[0], &type);
  if (type != napi_function) {
    return MakeStartResult(env, false, "Listener callback must be a function");
  }

  if (g_isListening.load()) {
    return MakeStartResult(env, true, "");
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
    return MakeStartResult(env, false, "Failed to create thread-safe callback");
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
    return MakeStartResult(env, false, "Timed out while starting native hook");
  }

  if (!g_startOk) {
    const std::string error = g_startError;
    lock.unlock();
    if (g_hookThread.joinable()) {
      g_hookThread.join();
    }
    ReleaseThreadsafeFunction();
    return MakeStartResult(env, false, error);
  }

  return MakeStartResult(env, true, "");
}

napi_value StopHook(napi_env env, napi_callback_info) {
  if (g_isRunning.load() && g_runLoop != nullptr) {
    CFRunLoopStop(g_runLoop);
  }

  if (g_hookThread.joinable()) {
    g_hookThread.join();
  }

  ReleaseThreadsafeFunction();

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
    { "isAccessibilityGranted", nullptr, IsAccessibilityGranted, nullptr, nullptr, nullptr, napi_default, nullptr },
    { "requestAccessibilityPrompt", nullptr, RequestAccessibilityPrompt, nullptr, nullptr, nullptr, napi_default, nullptr },
    { "openAccessibilitySettings", nullptr, OpenAccessibilitySettings, nullptr, nullptr, nullptr, napi_default, nullptr }
  };

  napi_define_properties(env, exports, sizeof(descriptors) / sizeof(descriptors[0]), descriptors);
  return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)
