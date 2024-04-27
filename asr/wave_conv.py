import wave
import io


def to_wav(wavedat):
    # raw -> wav変換
    raw = io.BytesIO()
    with wave.open(raw, "wb") as out_f:
        out_f.setnchannels(1)
        out_f.setsampwidth(2)  # number of bytes
        out_f.setframerate(16000)
        out_f.writeframesraw(wavedat)
    raw.seek(0)
    return raw


def to_wavfile(wavedat, filename):
    # raw -> wavファイル保存
    raw = to_wav(wavedat)
    with open(filename, "wb") as f:
        f.write(raw.getbuffer())
