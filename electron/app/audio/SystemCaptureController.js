import { EventEmitter } from "events";
import { createRequire } from "module";
import { AudioChunker } from "../../../shared/audio/chunker.js";
import { downsampleFloat32, interleavedInt16ToMono } from "../../../shared/audio/signal.js";
import { encodeWav } from "../../../shared/audio/wav.js";
import { DEFAULT_LANGUAGE, SYSTEM_CHUNK_OPTIONS, TARGET_SAMPLE_RATE } from "../../../shared/audio/constants.js";

const require = createRequire(import.meta.url);
const naudiodon = require("naudiodon");

const DEFAULTS = {
  language: DEFAULT_LANGUAGE,
  channels: 2,
  sampleRate: 48000,
  maxQueue: 4,
  ...SYSTEM_CHUNK_OPTIONS
};

export class SystemCaptureController extends EventEmitter {
  constructor(transcriber) {
    super();
    this.transcriber = transcriber;
    this.audioIn = null;
    this.isCapturing = false;
    this.isStopping = false;
    this.queue = [];
    this.processing = false;
    this.chunkIndex = 0;
    this.options = { ...DEFAULTS };
    this.chunker = null;
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

    if (!this.transcriber?.isInitialized) {
      throw new Error("Transcriber not initialized");
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
    this.queue = [];
    this.processing = false;
    this.chunkIndex = 0;
    this.chunker = new AudioChunker({
      sampleRate,
      silenceThreshold: this.options.silenceThreshold,
      silenceMs: this.options.silenceMs,
      maxChunkMs: this.options.maxChunkMs,
      minChunkMs: this.options.minChunkMs
    });

    this.audioIn = new naudiodon.AudioIO({
      inOptions: {
        channelCount,
        sampleFormat: naudiodon.SampleFormat16Bit,
        sampleRate,
        deviceId: device.id,
        closeOnError: true
      }
    });

    this.audioIn.on("data", (buffer) => this.handleAudioData(buffer));
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
      console.warn("SystemCaptureController: failed to stop audio input:", error);
    }

    this.audioIn = null;

    const pending = this.chunker?.flush({ force: true, reason: "stop" });
    if (pending) {
      this.enqueueTranscription(pending);
    }
    this.chunker = null;

    this.emit("status", { isCapturing: false });
    return { stopped: true };
  }

  handleAudioData(buffer) {
    if (!this.isCapturing || this.isStopping) return;

    const monoFloat = interleavedInt16ToMono(buffer, this.options.channels);
    const chunk = this.chunker?.push(monoFloat);
    if (chunk) {
      this.enqueueTranscription(chunk);
    }
  }

  enqueueTranscription({ samples, durationMs, reason }) {
    if (this.queue.length >= this.options.maxQueue) {
      this.queue.shift();
    }

    const downsampled = downsampleFloat32(samples, this.options.sampleRate, TARGET_SAMPLE_RATE);
    const wavBytes = encodeWav(downsampled, TARGET_SAMPLE_RATE, 1);
    const wavBuffer = Buffer.from(wavBytes);

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
        const result = await this.transcriber.transcribe(item.wavBuffer, {
          language: this.options.language
        });
        this.emit("transcription", {
          ...result,
          source: "system",
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
