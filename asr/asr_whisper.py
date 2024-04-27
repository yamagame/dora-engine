import whisper
import numpy as np
import wave_conv
import requests
import os

count_max = 100


class WhisperAsr:
    def __init__(self):
        self.model = whisper.load_model("medium")
        self.count = 0

    def transcribe(self, wavedat):
        fname = 'work/received-'+str(self.count)+'.wav'
        wave_conv.to_wavfile(wavedat, fname)
        self.count += 1
        if self.count > count_max:
            self.count = 1

        fullpath = os.path.abspath(fname)

        print(fullpath)

        # 音声認識
        response = requests.post(
            url="http://localhost:8080/inference",
            files={
                "file": fullpath,
                "temperature": "0.0",
                "language": "ja",
                "temperature_inc": "0.2",
                "response_format": "json",
            },
            headers={},
        )
        if response.status_code == 200:
            result = response.json()
            if "text" in result:
                return result["text"]
        return ""

    def transcribe_(self, wavedat):
        raw = wave_conv.to_wav(wavedat)

        y = np.frombuffer(raw.getbuffer(),
                          dtype=np.int16
                          ).astype(np.float32)

        # 音声データを 0 〜 1 にスケーリング
        scale = 1./float(1 << ((8*2) - 1))
        y *= scale

        # 音声認識
        result = self.model.transcribe(y)
        if "text" in result:
            return result["text"]
        return ""


if __name__ == '__main__':
    import http.client as http_client
    http_client.HTTPConnection.debuglevel = 1
    response = requests.post(
        "http://localhost:8080/inference",
        files={
            "file": "/Users/yamagame/Documents/MacBookAir/Develop/dora-engine/asr/work/received-0.wav",
            "temperature": "0.0",
            "language": "ja",
            "temperature_inc": "0.2",
            "response_format": "json",
        },
        headers={},
    )
    if response.status_code == 200:
        result = response.json()
        if "text" in result:
            print(result["text"])
