import { EventEmitter } from "events";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const naudiodon = require("naudiodon");

const TARGET_SAMPLE_RATE = 16000;
const DEFAULTS = {
  language: "pt",
  chunkMs: 15000,
  maxChunkMs: 20000,
  minChunkMs: 2000,
  silenceMs: 1500,
  silenceThreshold: 0.003,
  channels: 2,
  sampleRate: 48000,
  maxQueue: 4
};

const int16ToFloat32 = (sample) => sample / 32768;

const interleavedInt16ToMono = (buffer, channels) => {
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
    mono[frame] = int16ToFloat32(sum / channels);
  }

  return mono;
};

const downsampleBuffer = (buffer, inputRate, targetRate) => {
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

const float32ToInt16Buffer = (float32Data) => {
  const buffer = Buffer.alloc(float32Data.length * 2);
  for (let i = 0; i < float32Data.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, float32Data[i]));
    const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    buffer.writeInt16LE(int16, i * 2);
  }
  return buffer;
};

const createWavBuffer = (pcmBuffer, sampleRate, channels = 1) => {
  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcmBuffer.length;

  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bytesPerSample * 8, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
  pcmBuffer.copy(buffer, 44);

  return buffer;
};

const computeRms = (buffer) => {
  const totalSamples = buffer.length / 2;
  if (!totalSamples) return 0;

  let sumSquares = 0;
  for (let i = 0; i < buffer.length; i += 2) {
    const sample = buffer.readInt16LE(i) / 32768;
    sumSquares += sample * sample;
  }

  return Math.sqrt(sumSquares / totalSamples);
};

export class SystemAudioCaptureService extends EventEmitter {
  constructor(whisperService) {
    super();
    this.whisperService = whisperService;
    this.audioIn = null;
    this.isCapturing = false;
    this.isStopping = false;
    this.queue = [];
    this.processing = false;
    this.chunkIndex = 0;
    this.options = { ...DEFAULTS };
    this.currentBuffers = [];
    this.currentByteLength = 0;
    this.currentFrames = 0;
    this.lastSoundTime = 0;
    this.hasSound = false;
  }

  listDevices() {
    return naudiodon.getDevices();
  }

  resolveLoopbackDevice({ deviceId, deviceName, preferredDeviceNames } = {}) {
    const devices = this.listDevices();
    if (!devices || !devices.length) return null;

    if (Number.isInteger(deviceId)) {
      return devices.find((device) => device.id === deviceId) || null;
    }

    const normalizedName = typeof deviceName === "string" ? deviceName.toLowerCase() : null;
    if (normalizedName) {
      const byName = devices.find(
        (device) =>
          device.maxInputChannels > 0 &&
          typeof device.name === "string" &&
          device.name.toLowerCase().includes(normalizedName)
      );
      if (byName) return byName;
    }

    const preferred = Array.isArray(preferredDeviceNames) ? preferredDeviceNames : [];
    for (const name of preferred) {
      const normalized = typeof name === "string" ? name.toLowerCase() : null;
      if (!normalized) continue;
      const match = devices.find(
        (device) =>
          device.maxInputChannels > 0 &&
          typeof device.name === "string" &&
          device.name.toLowerCase().includes(normalized)
      );
      if (match) return match;
    }

    const loopback = devices.find(
      (device) =>
        device.maxInputChannels > 0 &&
        typeof device.name === "string" &&
        device.name.toLowerCase().includes("loopback")
    );
    if (loopback) return loopback;

    const fallbackNames = [
      "stereo mix",
      "mixagem estéreo",
      "mixagem estereo",
      "wave out mix",
      "what u hear",
      "speakers"
    ];
    for (const name of fallbackNames) {
      const match = devices.find(
        (device) =>
          device.maxInputChannels > 0 &&
          typeof device.name === "string" &&
          device.name.toLowerCase().includes(name)
      );
      if (match) return match;
    }

    return null;
  }

  startCapture(options = {}) {
    if (this.isCapturing) {
      return { started: false, reason: "already_running" };
    }

    if (!this.whisperService?.isInitialized) {
      throw new Error("WhisperService not initialized");
    }

    this.options = { ...DEFAULTS, ...options };
    const device = this.resolveLoopbackDevice({
      deviceId: this.options.deviceId,
      deviceName: this.options.deviceName,
      preferredDeviceNames: this.options.preferredDeviceNames
    });

    if (!device) {
      return {
        started: false,
        reason: "no_loopback_device",
        message:
          "Nenhum dispositivo WASAPI loopback encontrado. Habilite 'Stereo Mix' no Windows ou instale um driver virtual (VB-Cable) e selecione o device.",
        devices: this.listDevices()
      };
    }

    const sampleRate = device.defaultSampleRate || this.options.sampleRate;
    const channelCount = Math.max(1, Math.min(device.maxInputChannels || 2, this.options.channels));

    this.options.sampleRate = sampleRate;
    this.options.channels = channelCount;

    this.isStopping = false;
    this.currentBuffers = [];
    this.currentByteLength = 0;
    this.currentFrames = 0;
    this.lastSoundTime = 0;
    this.hasSound = false;
    this.chunkIndex = 0;
    this.queue = [];
    this.processing = false;

    this.audioIn = new naudiodon.AudioIO({
      inOptions: {
        channelCount,
        sampleFormat: naudiodon.SampleFormat16Bit,
        sampleRate,
        deviceId: device.id,
        closeOnError: true
      }
    });

    this.audioIn.on("data", (buffer) => this.handleAudioData(buffer, sampleRate, channelCount));
    this.audioIn.on("error", (error) => {
      this.emit("error", error);
      this.stopCapture();
    });

    this.audioIn.start();
    this.isCapturing = true;
    this.emit("status", { isCapturing: true, device });
    return { started: true, device };
  }

  stopCapture() {
    if (!this.isCapturing) return { stopped: false, reason: "not_running" };

    this.isStopping = true;
    this.isCapturing = false;

    try {
      if (this.audioIn) {
        this.audioIn.quit();
      }
    } catch (error) {
      console.warn("SystemAudioCaptureService: failed to stop audio input:", error);
    }

    this.audioIn = null;
    this.flushChunk({ force: true, reason: "stop" });
    this.emit("status", { isCapturing: false });
    return { stopped: true };
  }

  handleAudioData(buffer, sampleRate, channelCount) {
    if (!this.isCapturing || this.isStopping) return;

    this.currentBuffers.push(buffer);
    this.currentByteLength += buffer.length;
    const frames = buffer.length / (2 * channelCount);
    this.currentFrames += frames;

    const rms = computeRms(buffer);
    const now = Date.now();
    if (rms > this.options.silenceThreshold) {
      this.hasSound = true;
      this.lastSoundTime = now;
    }

    const chunkMs = (this.currentFrames / sampleRate) * 1000;
    if (chunkMs >= this.options.maxChunkMs) {
      this.flushChunk({ force: true, reason: "max_chunk" });
      return;
    }

    if (this.hasSound && this.lastSoundTime && now - this.lastSoundTime > this.options.silenceMs) {
      this.flushChunk({ reason: "silence" });
    }
  }

  flushChunk({ force = false, reason = "unknown" } = {}) {
    if (!this.currentFrames) return;

    const durationMs = (this.currentFrames / this.options.sampleRate) * 1000;
    const shouldDiscard =
      !this.hasSound ||
      (!force && durationMs < this.options.minChunkMs);

    const buffers = this.currentBuffers;
    this.currentBuffers = [];
    this.currentByteLength = 0;
    this.currentFrames = 0;
    this.hasSound = false;
    this.lastSoundTime = 0;

    if (shouldDiscard) {
      return;
    }

    const pcmBuffer = Buffer.concat(buffers);
    const monoFloat = interleavedInt16ToMono(pcmBuffer, this.options.channels);
    const downsampled = downsampleBuffer(monoFloat, this.options.sampleRate, TARGET_SAMPLE_RATE);
    const pcm16 = float32ToInt16Buffer(downsampled);
    const wavBuffer = createWavBuffer(pcm16, TARGET_SAMPLE_RATE, 1);

    this.enqueueTranscription({
      wavBuffer,
      durationMs,
      reason
    });
  }

  enqueueTranscription({ wavBuffer, durationMs, reason }) {
    if (this.queue.length >= this.options.maxQueue) {
      this.queue.shift();
    }

    this.queue.push({
      wavBuffer,
      durationMs,
      reason,
      chunkIndex: this.chunkIndex += 1,
      timestamp: Date.now()
    });

    this.processQueue();
  }

  async processQueue() {
    if (this.processing) return;
    this.processing = true;
    this.emitProcessingState();

    while (this.queue.length) {
      const item = this.queue.shift();
      try {
        const result = await this.whisperService.transcribe(item.wavBuffer, {
          language: this.options.language
        });
        this.emit("transcription", {
          ...result,
          chunkIndex: item.chunkIndex,
          timestamp: item.timestamp,
          durationMs: item.durationMs,
          reason: item.reason
        });
      } catch (error) {
        this.emit("error", error);
      }
    }

    this.processing = false;
    this.emitProcessingState();
  }

  emitProcessingState() {
    this.emit("processing", {
      isProcessing: this.processing || this.queue.length > 0,
      queueSize: this.queue.length
    });
  }
}
