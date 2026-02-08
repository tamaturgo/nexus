import { spawn, spawnSync } from "child_process";
import path from "path";
import fs from "fs";
import os from "os";
import { app } from "electron";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class WhisperService {
  constructor() {
    this.isInitialized = false;
    this.whisperPath = null;
    this.modelPath = null;
    this.libPath = null;
    this.tempDir = path.join(os.tmpdir(), "nexus-audio");

    // Criar diretório temporário
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  async initialize() {
    try {
      // Detectar o diretório base da aplicação
      const isDev = !app.isPackaged;
      const basePath = isDev
        ? path.join(__dirname, "../../")
        : path.dirname(app.getPath("exe"));

      // Configurar caminhos para Windows
      const platform = os.platform();
      if (platform === "win32") {
        this.whisperPath = path.join(
          basePath,
          "resources/bin/win/whisper-cli.exe"
        );
        this.libPath = path.join(basePath, "resources/bin/win");

        const modelDir = path.join(basePath, "resources/models");
        const possibleModels = [
          "ggml-base.bin",
          "ggml-small.bin",
          "ggml-tiny.bin",
          "ggml-medium.bin",
        ];

        for (const model of possibleModels) {
          const modelPath = path.join(modelDir, model);
          if (fs.existsSync(modelPath)) {
            this.modelPath = modelPath;
            break;
          }
        }

        if (!fs.existsSync(this.whisperPath)) {
          throw new Error(`Whisper binary not found at: ${this.whisperPath}`);
        }

        if (!this.modelPath) {
          console.warn("WhisperService: No model found.");
        }

        console.log("WhisperService: Initialized (Windows)");
        console.log(`  Binary: ${this.whisperPath}`);
        console.log(`  Model: ${this.modelPath}`);
      } else {
        throw new Error(`Platform ${platform} not yet supported`);
      }

      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error("WhisperService: Initialization failed:", error);
      return false;
    }
  }

  async transcribe(audioBuffer, options = {}) {
    const { language = "pt" } = options;

    if (!this.isInitialized) throw new Error("WhisperService not initialized");
    if (!this.modelPath) throw new Error("Whisper model not found");

    try {
      console.log(`WhisperService: Processing ${audioBuffer.length} bytes`);

      const timestamp = Date.now();
      const audioFilePath = await this.saveAudioToFile(
        audioBuffer,
        `rec-${timestamp}.wav`
      );

      const result = await this.runWhisper(audioFilePath, language);

      try {
        if (fs.existsSync(audioFilePath)) fs.unlinkSync(audioFilePath);
      } catch (e) {
        console.warn("Failed to delete temp audio file:", e);
      }

      return {
        text: result.text,
        language: language,
        duration: result.duration || 0,
        confidence: result.confidence || 0.9,
      };
    } catch (error) {
      console.error("WhisperService: Transcription failed:", error);
      throw error;
    }
  }

  async runWhisper(audioFilePath, language) {
    return new Promise((resolve, reject) => {
      const whisperPath = this.whisperPath;

      const modelPath = this.getShortPath(this.modelPath);
      const inputPath = this.getShortPath(audioFilePath);
      
      const tempDirShort = this.getShortPath(this.tempDir);
      const outputPath = path.join(tempDirShort, "output"); 

      const args = [
        "-m", modelPath,
        "-f", inputPath,
        "-l", language,
        "--no-flash-attn",
        "--no-gpu",
        "--output-txt",
        "--output-file", outputPath,
        "--no-prints",
      ];

      // Configurar environment
      const env = { ...process.env };
      if (os.platform() === "win32" && this.libPath) {
        env.PATH = this.libPath + ";" + (env.PATH || "");
      }

      console.log("WhisperService: Command:", whisperPath, args.join(" "));

      const whisperProcess = spawn(whisperPath, args, {
        env,
        stdio: ["ignore", "pipe", "pipe"],
        windowsVerbatimArguments: true,
      });

      let stdout = "";
      let stderr = "";

      whisperProcess.stdout.on("data", (data) => (stdout += data.toString()));
      whisperProcess.stderr.on("data", (data) => (stderr += data.toString()));

      whisperProcess.on("error", (error) => {
        reject(new Error(`Failed to start whisper process: ${error.message}`));
      });

      whisperProcess.on("close", (code) => {
        if (code !== 0) {
          console.warn(`Whisper stderr: ${stderr}`);
        }

        const expectedOutputFile = `${outputPath}.txt`;
        
        const fallbackFile = path.join(this.tempDir, "output.txt");

        try {
          let text = "";
          
          if (fs.existsSync(expectedOutputFile)) {
            text = fs.readFileSync(expectedOutputFile, "utf-8").trim();
            fs.unlinkSync(expectedOutputFile);
          } else if (fs.existsSync(fallbackFile)) {
            text = fs.readFileSync(fallbackFile, "utf-8").trim();
            fs.unlinkSync(fallbackFile);
          } else {
            text = stdout.trim() || stderr.trim();
          }

          if (!text && code !== 0) {
            reject(new Error(`Whisper failed with code ${code}: ${stderr}`));
            return;
          }

          resolve({
            text: text || "",
            duration: 0,
            confidence: 0.9,
          });
        } catch (error) {
          reject(new Error(`Failed to read output: ${error.message}`));
        }
      });
    });
  }

  getShortPath(inputPath) {
    if (os.platform() !== "win32" || !inputPath) return inputPath;

    try {
      const resolvedPath = path.resolve(inputPath);
      
      if (!fs.existsSync(resolvedPath)) {
        return resolvedPath;
      }

      const command = `chcp 65001 > nul && for %I in ("${resolvedPath}") do @echo %~sI`;

      const result = spawnSync("cmd", ["/c", command], {
        windowsHide: true,
        encoding: "utf8",
        shell: true //
      });

      if (result.error) return resolvedPath;

      const output = (result.stdout || "").trim();
      const match = output.match(/([a-zA-Z]:\\[^\s\r\n"]+)/);
      
      if (match && match[1]) {
          // Remove barra invertida final se existir (causa do erro "file not found")
          let clean = match[1];
          if (clean.endsWith('\\') && !clean.endsWith(':\\')) {
              clean = clean.slice(0, -1);
          }
          return clean;
      }

      return resolvedPath;
    } catch (error) {
      console.warn("WhisperService: Short path failed, using original:", error);
      return inputPath;
    }
  }

  async saveAudioToFile(audioBuffer, filename) {
    const filepath = path.join(this.tempDir, filename);
    try {
      fs.writeFileSync(filepath, audioBuffer);
    } catch (error) {
      console.error("WhisperService: Failed to write temp file:", error);
      throw error;
    }

    try {
      const stats = fs.statSync(filepath);
      console.log(
        `WhisperService: Saved ${stats.size} bytes to ${filepath}`
      );
    } catch (error) {
      console.warn("WhisperService: Failed to stat temp file:", error);
    }

    return filepath;
  }

  cleanup() {
    try {
      if (fs.existsSync(this.tempDir)) {
        fs.rmSync(this.tempDir, { recursive: true, force: true });
      }
    } catch (error) {
      console.error("Cleanup failed:", error);
    }
  }
}