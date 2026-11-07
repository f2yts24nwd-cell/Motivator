#!/usr/bin/env python3
"""Generates the voice lines of "Frag den Danny!" offline with Piper TTS.

Usage:
  pip install piper-tts
  # German Piper voices (v0.0.2 release on GitHub), extracted into one folder:
  #   https://github.com/rhasspy/piper/releases/download/v0.0.2/voice-de-<name>-low.tar.gz
  #   names: thorsten, karlsson, kerstin, ramona, eva_k-x  (eva_k is "x-low")
  #   Only CC0 (thorsten, kerstin) and M-AILABS voices (karlsson, ramona, eva_k) are used;
  #   pavoque is non-commercial (CC BY-NC-SA) and therefore left out.
  python3 scripts/make-danny-voices.py /path/to/voices

Reads src/games/danny/voices.json and writes public/danny/voice/<id>.mp3 (mono, 64 kbps).
Every character is one Piper voice plus an ffmpeg treatment (pitch, radio, echo, crowd).
"""
import json, os, subprocess, sys, tempfile, glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VOICES = sys.argv[1] if len(sys.argv) > 1 else '.'
OUT = os.path.join(ROOT, 'public', 'danny', 'voice')
os.makedirs(OUT, exist_ok=True)

def model(name):
    m = glob.glob(os.path.join(VOICES, f'voice-de-{name}*', '*.onnx'))
    if not m:
        sys.exit(f'voice {name} not found in {VOICES}')
    return m[0]

# character -> (piper voice, length scale, noise scale, ffmpeg filter)
PITCH = lambda f: f'asetrate=16000*{f},aresample=22050,atempo={1 / f:.4f}'
CAST = {
    'danny':    ('thorsten', 0.92, 0.75, PITCH(0.96) + ',bass=g=4,acompressor=threshold=-18dB:ratio=3'),
    'karlsson': ('karlsson', 0.9, 0.8, 'aresample=22050'),
    'dev':      ('thorsten', 0.82, 0.8, PITCH(1.12)),
    'kunde':    ('thorsten', 1.05, 0.7, PITCH(0.84) + ',bass=g=3'),
    'kerstin':  ('kerstin', 0.92, 0.7, 'aresample=22050,highpass=f=450,lowpass=f=3200,acrusher=bits=10:mode=log:aa=1,volume=1.6'),
    'ramona':   ('ramona', 0.9, 0.8, 'aresample=22050'),
    'eva':      ('eva_k', 0.92, 0.8, 'aresample=22050'),
    'monster':  ('karlsson', 1.1, 0.6, PITCH(0.66) + ',aecho=0.8:0.7:60|120:0.45|0.3,bass=g=6'),
}

def piper(voice, text, length, noise, wav):
    m = model(voice)
    subprocess.run(['piper', '-m', m, '-c', m + '.json', '-f', wav, '--length-scale', str(length), '--noise-scale', str(noise)],
                   input=text.encode('utf-8'), check=True, capture_output=True)

def to_mp3(src, flt, dst):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-af', flt + ',loudnorm=I=-16:TP=-1.5,aresample=22050', '-ac', '1',
                    '-codec:a', 'libmp3lame', '-b:a', '64k', dst], check=True)

lines = json.load(open(os.path.join(ROOT, 'src', 'games', 'danny', 'voices.json')))['lines']
with tempfile.TemporaryDirectory() as tmp:
    for lid, L in lines.items():
        dst = os.path.join(OUT, f'{lid}.mp3')
        if L['voice'] == 'crowd':
            # five colleagues shout at once, slightly staggered and detuned
            parts = []
            for i, (v, f, d) in enumerate([('thorsten', 0.95, 0), ('karlsson', 1.0, 60), ('kerstin', 1.08, 130), ('ramona', 1.0, 40), ('eva_k', 1.02, 180)]):
                w = os.path.join(tmp, f'c{i}.wav')
                piper(v, L['text'], 1.25, 0.8, w)
                parts.append((w, f, d))
            inputs = sum([['-i', p[0]] for p in parts], [])
            chains = ';'.join(f'[{i}:a]{PITCH(f)},adelay={d}|{d}[a{i}]' for i, (_, f, d) in enumerate(parts))
            mix = ''.join(f'[a{i}]' for i in range(len(parts))) + f'amix=inputs={len(parts)}:normalize=0,aecho=0.6:0.5:40:0.3,loudnorm=I=-14:TP=-1'
            subprocess.run(['ffmpeg', '-v', 'error', '-y', *inputs, '-filter_complex', chains + ';' + mix, '-ac', '1', '-ar', '22050',
                            '-codec:a', 'libmp3lame', '-b:a', '64k', dst], check=True)
        else:
            voice, length, noise, flt = CAST[L['voice']]
            w = os.path.join(tmp, f'{lid}.wav')
            piper(voice, L['text'], length, noise, w)
            to_mp3(w, flt, dst)
        print(lid, os.path.getsize(dst))
