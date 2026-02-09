export const computeRms = (float32Data) => {
  if (!float32Data || float32Data.length === 0) return 0;

  let sumSquares = 0;
  for (let i = 0; i < float32Data.length; i += 1) {
    const sample = float32Data[i];
    sumSquares += sample * sample;
  }

  return Math.sqrt(sumSquares / float32Data.length);
};

export const downsampleFloat32 = (buffer, inputRate, targetRate) => {
  if (inputRate === targetRate) return buffer;

  const ratio = inputRate / targetRate;
  const newLength = Math.round(buffer.length / ratio);
  const result = new Float32Array(newLength);

  let offsetResult = 0;
  let offsetBuffer = 0;

  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
    let accum = 0;
    let count = 0;

    for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i += 1) {
      accum += buffer[i];
      count += 1;
    }

    result[offsetResult] = count ? accum / count : 0;
    offsetResult += 1;
    offsetBuffer = nextOffsetBuffer;
  }

  return result;
};

export const interleavedInt16ToMono = (buffer, channels) => {
  const totalSamples = buffer.length / 2;
  const frames = Math.floor(totalSamples / channels);
  const mono = new Float32Array(frames);

  let offset = 0;
  for (let frame = 0; frame < frames; frame += 1) {
    let sum = 0;
    for (let ch = 0; ch < channels; ch += 1) {
      const sample = buffer.readInt16LE(offset);
      sum += sample;
      offset += 2;
    }
    mono[frame] = sum / channels / 32768;
  }

  return mono;
};

export const mergeChunks = (chunks) => {
  if (!chunks || chunks.length === 0) return new Float32Array(0);

  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Float32Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }

  return merged;
};