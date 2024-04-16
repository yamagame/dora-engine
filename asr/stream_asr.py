#!/usr/bin/env python
import warnings
from dotenv import load_dotenv
import io
import os
import threading
import socket
import time
import torch
import wave
import numpy as np
from inaSpeechSegmenter import Segmenter
from inaSpeechSegmenter.sidekit_mfcc import mfcc
from espnet_onnx import Speech2Text
from pyannote.audio import Pipeline
from proto.wave_pb2 import WaveUnit

warnings.simplefilter('ignore', FutureWarning)


load_dotenv()
HUGGINGFACE_TOKEN = ""
if "HUGGINGFACE_TOKEN" in os.environ:
    HUGGINGFACE_TOKEN = os.environ['HUGGINGFACE_TOKEN']

print("> STEP1:", flush=True)


def speakerDiarization():
    """
    話者分離準備
    """
    if HUGGINGFACE_TOKEN == "":
        return
    # pipeline = Pipeline.from_pretrained(
    #     "pyannote/speaker-diarization-3.1",
    #     use_auth_token=HUGGINGFACE_TOKEN)
    pipeline = Pipeline.from_pretrained(
        "pyannote/speaker-diarization-3.1")

    pipeline.to(torch.device("mps"))
    return pipeline


print("> STEP2:", flush=True)

pipeline = speakerDiarization()

print("> STEP3:", flush=True)


def diarization(filename):
    """
    話者分離
    """
    if HUGGINGFACE_TOKEN == "":
        return
    # apply pretrained pipeline
    diarization = pipeline(filename)

    retval = False

    # print the result
    for turn, _, speaker in diarization.itertracks(yield_label=True):
        print("> speaker:", speaker)
        print(f"start={turn.start:.1f}s stop={turn.end:.1f}s speaker_{speaker}")
        retval = True

    return retval


seg = Segmenter()

serv_address = ('127.0.0.1', 8890)
sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
sock.bind(serv_address)

M_SIZE = 1024
speech2text = Speech2Text(tag_name='reazon-research/reazonspeech-espnet-v2')

buf = []


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


def segmentation(y):
    # inaSpeechSegmenterを使用してセグメント分析
    _, loge, _, mspec = mfcc(y, get_mspec=True)
    # print(len(loge), mspec)

    difflen = 0
    if len(loge) < 68:
        difflen = 68 - len(loge)
        mspec = np.concatenate((mspec, np.ones((difflen, 24)) * np.min(mspec)))

    segmentation = seg.segment_feats(mspec, loge, difflen, 0)
    print(segmentation)

    # 人の声が入っているか？
    for v in segmentation:
        if v[0] != 'male' and v[0] != 'female':
            return True
    return False


def transcribe(sample):
    """
    音声認識
    """
    y = np.frombuffer(sample,
                      dtype=np.int16
                      ).astype(np.float32)

    # # セグメント分析
    # if not segmentation(t):
    #     return [[]]

    # 音声データを 0 〜 1 にスケーリング
    scale = 1./float(1 << ((8*2) - 1))
    y *= scale

    # 音声認識
    return speech2text(y)


MAX_SAMPLE_BUFFER = 16000*2*20  # 受信バッファは最大60秒
start = time.time()
received = []
received_sample_size = 0
sample = bytes(0)
# received = 0

# 音声データは 16bit、littleエンディアン、16KHz のみ対応

print("> サーバー起動", flush=True)

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
                    res = transcribe(wavedat)
                    if len(res) > 0 and len(res[0]) > 0:
                        # 認識結果表示
                        print("> transcribe:", res[0][0], time.time()-start)
                        print("decoder:", res[0][3].scores["decoder"], "ctc:", res[0]
                              [3].scores["ctc"], "lm:", res[0][3].scores["lm"])
                        # raw -> wav 変換
                        raw = io.BytesIO()
                        with wave.open(raw, "wb") as out_f:
                            out_f.setnchannels(1)
                            out_f.setsampwidth(2)  # number of bytes
                            out_f.setframerate(16000)
                            out_f.writeframesraw(wavedat)
                        raw.seek(0)
                        # 話者分離
                        if diarization(raw):
                            print("> 認識結果:", res[0][0], flush=True)
                    else:
                        print(res)
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
