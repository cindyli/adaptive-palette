"""
Speak text into a .wav file with the Kokoro voice model. Called by Narrate.ts.

Usage: python kokoro.py <model dir> <voice> <lang> <sentence pause seconds> <out.wav> <text>
"""
import os
import re
import sys

import numpy as np
import soundfile as sf
from kokoro_onnx import EspeakConfig, Kokoro

model_dir, voice, lang, pause, out_file, text = sys.argv[1:]

# The espeak-ng bundled with kokoro-onnx is broken on Intel Macs, so use Homebrew's when it is there.
espeak = None
for prefix in ("/opt/homebrew", "/usr/local"):
    lib = f"{prefix}/opt/espeak-ng/lib/libespeak-ng.dylib"
    if os.path.exists(lib):
        espeak = EspeakConfig(lib_path=lib, data_path=f"{prefix}/opt/espeak-ng/share/espeak-ng-data")
        break

kokoro = Kokoro(os.path.join(model_dir, "kokoro-v1.0.onnx"), os.path.join(model_dir, "voices-v1.0.bin"),
                espeak_config=espeak)

# Speak each sentence on its own and put silence between them, so ideas stay apart.
parts = []
rate = 24000
for sentence in re.split(r"(?<=[.!?:])\s+", text.strip()):
    samples, rate = kokoro.create(sentence, voice=voice, speed=0.95, lang=lang)
    if parts:
        parts.append(np.zeros(int(rate * float(pause)), dtype=samples.dtype))
    parts.append(samples)
sf.write(out_file, np.concatenate(parts), rate)
