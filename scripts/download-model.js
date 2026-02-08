import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import https from "https";
import http from "http";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MODEL_URL = process.env.WHISPER_MODEL_URL;
const MODEL_SHA256 = process.env.WHISPER_MODEL_SHA256;
const MODEL_NAME = process.env.WHISPER_MODEL_NAME || "ggml-small.bin";
const MODELS_DIR = process.env.WHISPER_MODELS_DIR || path.join(__dirname, "..", "resources", "models");
const MODEL_PATH = path.join(MODELS_DIR, MODEL_NAME);

const log = (...args) => console.log("[model-download]", ...args);

const hashFile = (filepath) =>
  new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filepath);
    stream.on("error", reject);
    stream.on("data", (data) => hash.update(data));
    stream.on("end", () => resolve(hash.digest("hex")));
  });

const downloadFile = (url, destination) =>
  new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    const request = client.get(url, (response) => {
      if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        return resolve(downloadFile(response.headers.location, destination));
      }

      if (response.statusCode !== 200) {
        return reject(new Error(`HTTP ${response.statusCode}`));
      }

      fs.mkdirSync(path.dirname(destination), { recursive: true });
      const fileStream = fs.createWriteStream(destination);
      response.pipe(fileStream);
      fileStream.on("finish", () => fileStream.close(resolve));
      fileStream.on("error", reject);
    });

    request.on("error", reject);
  });

const run = async () => {
  if (!MODEL_URL) {
    log("WHISPER_MODEL_URL não definido. Pulando download.");
    return;
  }

  if (fs.existsSync(MODEL_PATH)) {
    if (MODEL_SHA256) {
      const digest = await hashFile(MODEL_PATH);
      if (digest.toLowerCase() === MODEL_SHA256.toLowerCase()) {
        log(`Modelo já existe e hash confere: ${MODEL_PATH}`);
        return;
      }
      log("Hash do modelo não confere. Rebaixando para novo download.");
      fs.unlinkSync(MODEL_PATH);
    } else {
      log(`Modelo já existe: ${MODEL_PATH}`);
      return;
    }
  }

  log(`Baixando modelo: ${MODEL_URL}`);
  await downloadFile(MODEL_URL, MODEL_PATH);

  if (MODEL_SHA256) {
    const digest = await hashFile(MODEL_PATH);
    if (digest.toLowerCase() !== MODEL_SHA256.toLowerCase()) {
      throw new Error("Hash SHA256 não confere após download.");
    }
  }

  log(`Modelo pronto em ${MODEL_PATH}`);
};

run().catch((error) => {
  console.error("[model-download] Falha no download:", error.message);
  process.exitCode = 1;
});
