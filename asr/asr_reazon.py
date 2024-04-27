from espnet_onnx import Speech2Text
import numpy as np


class ReazonAsr:
    def __init__(self):
        self.speech2text = Speech2Text(
            tag_name='reazon-research/reazonspeech-espnet-v2')

    def transcribe(self, sample):
        """
        音声認識
        """
        y = np.frombuffer(sample,
                          dtype=np.int16
                          ).astype(np.float32)

        # 音声データを 0 〜 1 にスケーリング
        scale = 1./float(1 << ((8*2) - 1))
        y *= scale

        # 音声認識
        res = self.speech2text(y)
        if len(res) > 0 and len(res[0]) > 0:
            print("decoder:", res[0][3].scores["decoder"], "ctc:", res[0]
                  [3].scores["ctc"], "lm:", res[0][3].scores["lm"])
            return res[0][0]
        else:
            print(res)

        return ""
