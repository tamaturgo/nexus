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
        setTimeout(() => {
          resolve({
            answer: `[MOCK] You asked: "${prompt}". This is a mock response because you are not in Electron or the backend is disconnected.`,
            citations: []
          });
        }, 1500);
      });
    }
  }
}

export const aiService = new AIService();
