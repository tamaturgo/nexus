import { askAI, isElectron } from "../../infra/ipc/electronBridge.js";

export const askAi = async (prompt, options = {}) => {
  if (isElectron()) {
    try {
      console.log("Asking AI via Electron:", prompt);
      const result = await askAI({ prompt, options });
      return result;
    } catch (error) {
      console.error("Error calling AI via Electron:", error);
      throw error;
    }
  }

  return new Promise((resolve) => {
    const delay = 2000 + Math.random() * 2000;

    setTimeout(() => {
      resolve({
        answer: `[Transcricao Capturada]\n\n${prompt}\n\n---\n\n(Processamento de IA sera adicionado quando API key estiver disponivel)`,
        sections: [
          {
            title: "Informacoes da Captura",
            content: `- Tempo de processamento: ${(delay / 1000).toFixed(1)}s\n- Modo: Simulacao\n- Status: Transcricao salva na memoria vetorial`,
            type: "list"
          }
        ],
        citations: []
      });
    }, delay);
  });
};
