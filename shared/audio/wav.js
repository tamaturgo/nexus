export const float32ToInt16 = (float32Data) => {
  const output = new Int16Array(float32Data.length);
  for (let i = 0; i < float32Data.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, float32Data[i]));
    output[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return output;
};

export const encodeWav = (float32Data, sampleRate, channels = 1) => {
  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  const buffer = new ArrayBuffer(44 + float32Data.length * bytesPerSample);
  const view = new DataView(buffer);

  const writeString = (offset, value) => {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + float32Data.length * bytesPerSample, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bytesPerSample * 8, true);
  writeString(36, "data");
  view.setUint32(40, float32Data.length * bytesPerSample, true);

  const int16Data = float32ToInt16(float32Data);
  let offset = 44;
  for (let i = 0; i < int16Data.length; i += 1) {
    view.setInt16(offset, int16Data[i], true);
    offset += 2;
  }

  return new Uint8Array(buffer);
};