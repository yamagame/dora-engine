export class audioSettings {
  sampleSize: number = 0
  sampleRate: number = 0
  channelCount: number = 0
  littleEndian: boolean
  constructor(settings: MediaTrackSettings, littleEndian = true) {
    if (settings.sampleSize) this.sampleSize = settings.sampleSize
    if (settings.sampleRate) this.sampleRate = settings.sampleRate
    if (settings.channelCount) this.channelCount = settings.channelCount
    this.littleEndian = littleEndian
  }
}

export function sampleToWavAudio(buffer: Int16Array, settings: audioSettings) {
  const sampleCount = buffer.length

  const bytesPerSample = settings.sampleSize / 8
  const bitsPerByte = 8
  const dataLength = sampleCount * bytesPerSample
  const sampleRate = settings.sampleRate

  const arrayBuffer = new ArrayBuffer(44 + dataLength)
  const dataView = new DataView(arrayBuffer)

  dataView.setUint8(0, "R".charCodeAt(0)) // <10>
  dataView.setUint8(1, "I".charCodeAt(0))
  dataView.setUint8(2, "F".charCodeAt(0))
  dataView.setUint8(3, "F".charCodeAt(0))
  dataView.setUint32(4, 36 + dataLength, true)
  dataView.setUint8(8, "W".charCodeAt(0))
  dataView.setUint8(9, "A".charCodeAt(0))
  dataView.setUint8(10, "V".charCodeAt(0))
  dataView.setUint8(11, "E".charCodeAt(0))
  dataView.setUint8(12, "f".charCodeAt(0))
  dataView.setUint8(13, "m".charCodeAt(0))
  dataView.setUint8(14, "t".charCodeAt(0))
  dataView.setUint8(15, " ".charCodeAt(0))
  // fmtチャンクのバイト数: PCMの場合は16バイト固定
  dataView.setUint32(16, 16, true)
  // 音声フォーマット: 1:PCM
  dataView.setUint16(20, 1, true)
  // チャンネル数: 1チャンネル
  dataView.setUint16(22, 1, true)
  // サンプリング周波数(Hz): 48000
  dataView.setUint32(24, sampleRate, true)
  // 1秒あたりバイト数の平均: 48000 * 2
  dataView.setUint32(28, sampleRate * bytesPerSample, true)
  // ブロックサイズ: 2バイト
  dataView.setUint16(32, bytesPerSample, true)
  // サンプルビット: 16ビット
  dataView.setUint16(34, bitsPerByte * bytesPerSample, true)
  dataView.setUint8(36, "d".charCodeAt(0))
  dataView.setUint8(37, "a".charCodeAt(0))
  dataView.setUint8(38, "t".charCodeAt(0))
  dataView.setUint8(39, "a".charCodeAt(0))
  dataView.setUint32(40, dataLength, true)

  let index = 44

  for (const value of buffer) {
    dataView.setInt16(index, value, settings.littleEndian)
    index += 2
  }

  return dataView
}
