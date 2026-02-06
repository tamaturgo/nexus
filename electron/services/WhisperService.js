import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { app } from 'electron';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class WhisperService {
  constructor() {
    this.isInitialized = false;
    this.whisperPath = null;
    this.modelPath = null;
    this.libPath = null;
    this.tempDir = path.join(os.tmpdir(), 'nexus-audio');
    
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
        ? path.join(__dirname, '../../') 
        : path.dirname(app.getPath('exe'));

      // Configurar caminhos para Windows
      const platform = os.platform();
      if (platform === 'win32') {
        // No Windows, o executável é whisper-cli.exe
        this.whisperPath = path.join(basePath, 'resources/bin/win/whisper-cli.exe');
        // As DLLs devem estar no mesmo diretório do executável
        this.libPath = path.join(basePath, 'resources/bin/win');
        
        // Verificar se o modelo existe
        const modelDir = path.join(basePath, 'resources/models');
        const possibleModels = [
          'ggml-base.bin',
          'ggml-small.bin',
          'ggml-tiny.bin',
          'ggml-medium.bin'
        ];

        for (const model of possibleModels) {
          const modelPath = path.join(modelDir, model);
          if (fs.existsSync(modelPath)) {
            this.modelPath = modelPath;
            break;
          }
        }

        // Verificar se o binário existe
        if (!fs.existsSync(this.whisperPath)) {
          throw new Error(`Whisper binary not found at: ${this.whisperPath}`);
        }

        // Se não encontrou modelo, avisa mas permite inicializar
        if (!this.modelPath) {
          console.warn('WhisperService: No model found, will need to download one');
          console.warn(`Expected model location: ${modelDir}`);
        }

        console.log('WhisperService: Initialized (Windows)');
        console.log(`  Binary: ${this.whisperPath}`);
        console.log(`  Model: ${this.modelPath || 'not found'}`);
        console.log(`  DLL path: ${this.libPath}`);
      } else {
        throw new Error(`Platform ${platform} not yet supported`);
      }

      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('WhisperService: Initialization failed:', error);
      return false;
    }
  }

  async transcribe(audioBuffer, options = {}) {
    const {
      language = 'pt',
      maxDuration = 30
    } = options;

    if (!this.isInitialized) {
      throw new Error('WhisperService not initialized');
    }

    if (!this.modelPath) {
      throw new Error('Whisper model not found. Please download a model to resources/models/');
    }

    try {
      console.log(`WhisperService: Processing ${audioBuffer.length} bytes of audio`);
      
      // Salvar áudio em arquivo temporário
      const timestamp = Date.now();
      const audioFilePath = await this.saveAudioToFile(audioBuffer, `audio-${timestamp}.wav`);

      // Executar whisper-cli
      const result = await this.runWhisper(audioFilePath, language);

      // Limpar arquivo temporário
      try {
        fs.unlinkSync(audioFilePath);
      } catch (e) {
        console.warn('Failed to delete temp audio file:', e);
      }

      console.log(`WhisperService: Transcription completed (${result.text.length} chars)`);

      return {
        text: result.text,
        language: language,
        duration: result.duration || 0,
        confidence: result.confidence || 0.9
      };
    } catch (error) {
      console.error('WhisperService: Transcription failed:', error);
      throw error;
    }
  }

  async runWhisper(audioFilePath, language) {
    return new Promise((resolve, reject) => {
      const args = [
        '-m', this.modelPath,
        '-f', audioFilePath,
        '-l', language,
        '--output-txt',
        '--output-file', path.join(this.tempDir, 'output'),
        '--no-prints'
      ];

      // Configurar environment
      const env = { ...process.env };
      
      // No Windows, adicionar o diretório das DLLs ao PATH
      if (os.platform() === 'win32' && this.libPath && fs.existsSync(this.libPath)) {
        env.PATH = this.libPath + ';' + (env.PATH || '');
      }

      console.log('WhisperService: Running command:', this.whisperPath, args.join(' '));

      const whisperProcess = spawn(this.whisperPath, args, {
        env,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      whisperProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      whisperProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      whisperProcess.on('error', (error) => {
        reject(new Error(`Failed to start whisper process: ${error.message}`));
      });

      whisperProcess.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Whisper process exited with code ${code}\nStderr: ${stderr}`));
          return;
        }

        // Ler o arquivo de saída
        const outputFile = path.join(this.tempDir, 'output.txt');
        try {
          if (fs.existsSync(outputFile)) {
            const text = fs.readFileSync(outputFile, 'utf-8').trim();
            fs.unlinkSync(outputFile); // Limpar arquivo de saída
            
            resolve({
              text,
              duration: 0, // Whisper CLI não retorna duration facilmente
              confidence: 0.9
            });
          } else {
            // Tentar extrair texto do stdout/stderr
            const text = stdout.trim() || stderr.trim();
            resolve({
              text: text || '',
              duration: 0,
              confidence: 0.9
            });
          }
        } catch (error) {
          reject(new Error(`Failed to read whisper output: ${error.message}`));
        }
      });
    });
  }

  async saveAudioToFile(audioBuffer, filename) {
    const filepath = path.join(this.tempDir, filename);
    
    // Converter para formato WAV se necessário
    // Por enquanto, assumir que o buffer já está em formato adequado
    // TODO: Adicionar conversão para WAV usando ffmpeg se necessário
    fs.writeFileSync(filepath, audioBuffer);
    
    return filepath;
  }

  cleanup() {
    // Limpar arquivos temporários
    try {
      if (fs.existsSync(this.tempDir)) {
        const files = fs.readdirSync(this.tempDir);
        files.forEach(file => {
          fs.unlinkSync(path.join(this.tempDir, file));
        });
      }
    } catch (error) {
      console.error('WhisperService: Cleanup failed:', error);
    }
  }
}
