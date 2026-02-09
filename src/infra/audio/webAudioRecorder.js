export class WebAudioRecorder {
  constructor({
    sampleRate = 16000,
    onPcm,
    audioConstraints = {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      sampleRate: 16000
    },
    getStream
  }) {
    this.sampleRate = sampleRate;
    this.onPcm = onPcm;
    this.audioConstraints = audioConstraints;
    this.getStream = getStream;

    this.audioContext = null;
    this.sourceNode = null;
    this.processorNode = null;
    this.stream = null;
  }

  async start() {
    if (this.getStream) {
      this.stream = await this.getStream();
    } else {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: this.audioConstraints
      });
    }

    this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: this.sampleRate
    });
    this.actualSampleRate = this.audioContext.sampleRate;

    await this.audioContext.audioWorklet.addModule(
      new URL("./pcmWorklet.js", import.meta.url)
    );

    this.sourceNode = this.audioContext.createMediaStreamSource(this.stream);
    this.processorNode = new AudioWorkletNode(this.audioContext, "pcm-processor");

    this.processorNode.port.onmessage = (event) => {
      if (this.onPcm) {
        this.onPcm(event.data);
      }
    };

    this.sourceNode.connect(this.processorNode);
    this.processorNode.connect(this.audioContext.destination);

    return this.stream;
  }

  async stop() {
    if (this.processorNode) {
      this.processorNode.disconnect();
      this.processorNode = null;
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
  }

  getSampleRate() {
    return this.actualSampleRate || this.sampleRate;
  }
}
