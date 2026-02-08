// Service to abstract AI interactions
// Currently this acts as a bridge to the Electron Main process

class AIService {
  constructor() {
    this.isElectron = window.electronAPI !== undefined;
  }

  /**
   * Sends a prompt to the AI and gets a response
   * @param {string} prompt - The user's query
   * @returns {Promise<object>} - The AI response (text, citations, etc.)
   */
  async ask(prompt) {
    if (this.isElectron) {
      try {
        console.log("Asking AI via Electron:", prompt);
        const result = await window.electronAPI.askAI(prompt);
        return result;
      } catch (error) {
        console.error("Error calling AI via Electron:", error);
        throw error;
      }
    } else {
      // Mock fallback for browser dev mode
      return new Promise((resolve) => {
        // Simular delay de processamento (2-4 segundos)
        const delay = 2000 + Math.random() * 2000;
        
        setTimeout(() => {
          // Retornar a transcrição sem processamento (como especificado)
          resolve({
            answer: `[Transcrição Capturada]\n\n${prompt}\n\n---\n\n(Processamento de IA será adicionado quando API key estiver disponível)`,
            sections: [
              {
                title: "Informações da Captura",
                content: `• Tempo de processamento: ${(delay/1000).toFixed(1)}s\n• Modo: Simulação\n• Status: Transcrição salva na memória vetorial`,
                type: "list"
              }
            ],
            citations: []
          });
        }, delay);
      });
    }
  }
}

export const aiService = new AIService();
