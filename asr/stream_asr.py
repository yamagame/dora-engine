#!/usr/bin/env python
import warnings
from dotenv import load_dotenv
import os
import sys
import threading
import socket
import time
import torch
# from inaSpeechSegmenter import Segmenter
from inaSpeechSegmenter.sidekit_mfcc import mfcc
from pyannote.audio import Pipeline
from proto.wave_pb2 import WaveUnit
import wave_conv

asrmode = "reazon"
if len(sys.argv) > 1:
    asrmode = sys.argv[1]


warnings.simplefilter('ignore', FutureWarning)


load_dotenv()
PYANNOTE_CHECK_POINT = ""  # huggingface のキャッシュ config.yaml へのパス
if "PYANNOTE_CHECK_POINT" in os.environ:
    PYANNOTE_CHECK_POINT = os.environ['PYANNOTE_CHECK_POINT']
HUGGINGFACE_TOKEN = ""  # huggingface へのアクセストークン
if "HUGGINGFACE_TOKEN" in os.environ:
    HUGGINGFACE_TOKEN = os.environ['HUGGINGFACE_TOKEN']


def speakerDiarization():
    """
    話者分離準備
    """
    # PYANNOTE_CHECK_POINT 優先
    if PYANNOTE_CHECK_POINT != "":
        pipeline = Pipeline.from_pretrained(
            checkpoint_path=PYANNOTE_CHECK_POINT)
        pipeline.to(torch.device("mps"))
        return pipeline
    # HUGGINGFACE_TOKEN を使用
    if HUGGINGFACE_TOKEN != "":
        pipeline = Pipeline.from_pretrained(
            "pyannote/speaker-diarization-3.1",
            use_auth_token=HUGGINGFACE_TOKEN)
        pipeline.to(torch.device("mps"))
        return pipeline

    return


print("> Pyannote 初期化", flush=True)

pipeline = speakerDiarization()


def diarization(raw):
    """
    話者分離
    """
    if HUGGINGFACE_TOKEN == "":
        return

    # raw -> wav
    wav = wave_conv.to_wav(raw)

    # apply pretrained pipeline
    diarization = pipeline(wav)

    retval = False

    # print the result
    for turn, track_name, speaker in diarization.itertracks(yield_label=True):
        print("> speaker:", speaker, track_name)
        print(f"start={turn.start:.1f}s stop={turn.end:.1f}s speaker_{speaker}")
        retval = True

    return retval


print("> Speech2Text 初期化:"+asrmode, flush=True)


def Speech2Text():
    if asrmode == "whisper":
        from asr_whisper import WhisperAsr
        return WhisperAsr()

    from asr_reazon import ReazonAsr
    return ReazonAsr()


speech2text = Speech2Text()

print("> UDP 受信スレッド開始", flush=True)

buf = []

M_SIZE = 1024
serv_address = ('127.0.0.1', 8890)
sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
sock.bind(serv_address)


def recieve():
    """
    音声受信スレッド
    """
    global buf
    global received_packet
    while True:
        wav, addr = sock.recvfrom(M_SIZE)
        waveunit = WaveUnit()
        waveunit.ParseFromString(wav)

        # print("> id:", waveunit.id, waveunit.action, flush=True)

        buf.append(waveunit)


t = threading.Thread(target=recieve, args=())
t.daemon = True
t.start()


# count = 1
# count_max = 100

MAX_SAMPLE_BUFFER = 16000*2*20  # 受信バッファは最大60秒
start = time.time()
received = []
received_sample_size = 0
sample = bytes(0)
# received = 0

# 音声データは 16bit、littleエンディアン、16KHz のみ対応

print("> 音声認識開始", flush=True)

while True:
    # スリープして受信スレッドに処理時間を与える
    time.sleep(0.1)
    next = True
    while next:
        next = False
        st = 0
        for idx, packet in enumerate(buf):
            if packet.action == WaveUnit.Action.ACTION_RESET:
                print("> RESET:", packet.id)
                received = []
                received_sample_size = 0
                buf = buf[idx+1:]
                break
            elif packet.action == WaveUnit.Action.ACTION_CLOSE or received_sample_size > MAX_SAMPLE_BUFFER:
                print("> CLOSE:", received_sample_size)
                sample = bytes(0)
                received.sort(key=lambda x: x.id)
                i = -1
                for idx, packet in enumerate(received):
                    if i < 0 or packet.id != i:
                        sample += packet.wave
                        i = packet.id
                    else:
                        print("> skip: ", packet.id)
                received = []
                # wavデータ受信完了
                print("received", len(sample))
                if len(sample) > 1:
                    wavedat = sample
                    # バッファを初期化
                    sample = bytes(0)
                    # 音声認識
                    start = time.time()
                    # Write the stuff
                    # fname = 'work/received-'+str(count)+'.wav'
                    # wave_conv.to_wavfile(wavedat, fname)
                    # count += 1
                    # if count > count_max:
                    #     count = 1
                    # 話者分離
                    if diarization(wavedat):
                        text = speech2text.transcribe(wavedat)
                        if text != "":
                            print("> 認識結果:", text, flush=True)
                    print("> 処理時間:", time.time()-start, flush=True)
                # バッファを初期化
                buf = buf[idx+1:]
                next = True
                break
            else:
                # wavデータ受信
                if len(received) == 0:
                    start = time.time()
                    received_sample_size = 0
                    print("start", start)
                if len(received) <= idx+1:
                    received.append(packet)
                    received_sample_size += len(packet.wave)
