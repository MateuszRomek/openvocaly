{
  "targets": [
    {
      "target_name": "ptt_hook_macos",
      "sources": ["src/ptt_hook.mm"],
      "xcode_settings": {
        "CLANG_CXX_LANGUAGE_STANDARD": "c++17",
        "MACOSX_DEPLOYMENT_TARGET": "11.0"
      },
      "link_settings": {
        "libraries": [
          "-framework ApplicationServices",
          "-framework AppKit",
          "-framework Foundation"
        ]
      }
    }
  ]
}
