// swift-tools-version: 6.0
import PackageDescription

let package = Package(
  name: "OpenVocalyAsrHost",
  platforms: [.macOS(.v14)],
  dependencies: [
    .package(
      url: "https://github.com/FluidInference/FluidAudio.git",
      revision: "6428e29186573c6d33c598e25d460e6690bc0ee1"
    )
  ],
  targets: [
    .executableTarget(
      name: "OpenVocalyAsrHost",
      dependencies: [
        .product(name: "FluidAudio", package: "FluidAudio")
      ]
    )
  ]
)
