#!/usr/bin/env python3
"""Narrow JSON-lines host for OpenVocaly's app-owned Qwen MLX models.

The TypeScript process owns model download and validation. This host receives
only local paths, keeps one model warm, and never calls Hugging Face itself.
"""

from __future__ import annotations

import gc
import json
import sys
from pathlib import Path
from typing import Any

import mlx.core as mx
from qwen3_asr_mlx import Qwen3ASR


class QwenEngine:
    """Keeps one Qwen model resident to avoid first-dictation loading cost."""

    def __init__(self) -> None:
        self._model: Qwen3ASR | None = None
        self._model_directory: Path | None = None

    def warm(self, model_directory: str) -> None:
        directory = self._required_directory(model_directory)
        if self._model is not None and directory == self._model_directory:
            return

        self.unload()
        self._model = Qwen3ASR.from_pretrained(directory)
        self._model.warm_up()
        self._model_directory = directory

    def transcribe(self, model_directory: str, file_path: str) -> dict[str, Any]:
        self.warm(model_directory)
        path = Path(file_path)
        if not path.is_file():
            raise ValueError("The requested audio file does not exist.")
        if self._model is None:
            raise RuntimeError("Qwen model is not loaded.")

        result = self._model.transcribe(path)
        return {
            "text": result.text.strip(),
            "language": result.language,
            "durationMs": round(result.duration * 1000),
        }

    def unload(self) -> None:
        if self._model is not None:
            self._model.close()
        self._model = None
        self._model_directory = None
        gc.collect()
        mx.clear_cache()

    @staticmethod
    def _required_directory(value: str) -> Path:
        directory = Path(value)
        if not directory.is_dir():
            raise ValueError("The requested Qwen model directory does not exist.")
        return directory


def send(response: dict[str, Any]) -> None:
    sys.stdout.write(json.dumps(response, separators=(",", ":")) + "\n")
    sys.stdout.flush()


def main() -> int:
    engine = QwenEngine()
    for raw_line in sys.stdin:
        request: dict[str, Any] = {}
        try:
            request = json.loads(raw_line)
            request_id = request["id"]
            command = request["command"]
            if command == "warm":
                engine.warm(request["modelDirectory"])
                send({"id": request_id, "ok": True})
            elif command == "transcribe":
                send(
                    {
                        "id": request_id,
                        "ok": True,
                        **engine.transcribe(request["modelDirectory"], request["filePath"]),
                    }
                )
            elif command == "unload":
                engine.unload()
                send({"id": request_id, "ok": True})
            else:
                raise ValueError(f"Unsupported Qwen MLX host command: {command}")
        except Exception as error:  # The host must return a protocol error, not crash Electron.
            send({"id": request.get("id", "unknown"), "ok": False, "error": str(error)})

    engine.unload()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
