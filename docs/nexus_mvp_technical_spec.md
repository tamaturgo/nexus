# Recally - Technical Specification & MVP Roadmap

## 1. Project Overview
Recally is a desktop application designed to integrate artificial intelligence directly into the operating system workflow. It functions as a productivity assistant that processes real-time context via audio capture (microphone and system) and screen capture.

**Core Philosophy:** Low latency, privacy-focused, hybrid processing (Local + Cloud).

## 2. Functional Requirements

### 2.1. Model Integration
*   **Agnostic Architecture:** Support for any LLM via API keys Gemini.
*   **Local Execution:** Native support for GGUF format models using Llama.cpp.


### 2.2. Context & Memory
*   **Ask AI:** Query capability regarding current or past meetings/screen content (e.g., retrieval of specific decisions).
*   **Vector Database:** Local storage of semantic data from audio transcripts and screen OCR.

### 2.3. Automation
*   **Custom Prompts:** User-defined triggers for data processing (e.g., "Summarize meeting", "Convert video to social posts").
*   **Stealth Mode:** Non-intrusive, always-on-top transparent overlay interface.

### 2.4. Integrations
*   **MCP (Model Context Protocol):** Implementation of connectors for external tools (Google Calendar, etc.).
*   **Computer Vision:** Screen reading capability for code, documents, and presentation interpretation.

## 3. Recommended Tech Stack

### Desktop Framework
*   **Primary:** Electron (JavaScript) - For robust API access and ecosystem maturity.

### Audio Processing
*   **Capture:** FFmpeg (System and Microphone audio streams).
*   **Transcription (STT):** OpenAI Whisper (Local implementation via whisper.cpp) for near real-time results on CPU.

### Computer Vision
*   **Capture:** Native OS screen capture APIs.
*   **Processing:** OpenCV or lightweight OCR libraries (Tesseract/EasyOCR) for text extraction.

### Data & Storage
*   **Vector Database:** ChromaDB or LanceDB (Running locally for privacy and speed).
*   **Persistence:** SQLite for application state and structured logs.

### AI Runtime
*   **Local:** Llama.cpp / Ollama (for GGUF).
*   **Cloud:** Vertex AI (Google) or OpenRouter API.

## 4. Hybrid Processing Strategy

To balance privacy, cost, and latency, the system must utilize a hybrid approach.

### 4.1. Local Processing (CPU/Low-resource)
*   **Hardware Target:** Modern CPUs (i5/i7/Ryzen 12th gen+), 8GB+ RAM.
*   **Tasks:**
    *   **STT:** Whisper (Tiny/Base models).
    *   **OCR:** Text extraction from screen frames.
    *   **RAG indexing:** Embedding generation for vector store.
    *   **Low-complexity LLM:** Models 1B-3B parameters (Phi-3.5 Mini, Gemma 2B) via Quantization.

### 4.2. Cloud Processing (On-demand)
*   **Tasks:**
    *   **Complex Reasoning:** Decision making, detailed analysis.
    *   **Creative Generation:** Content creation, social media formatting.
    *   **Deep Vision:** Interpreting complex visual scenes or long video history.
    *   **Large Context:** Summarizing multi-hour sessions exceeding local RAM limits.

## 5. Development Roadmap (MVP)

### Phase 1: Capture & Pipeline
1.  Implement main process capture loop (Video frames + Audio buffer) every X seconds.
2.  Develop the synchronization logic to align timestamps of visual and audio data.

### Phase 2: Processing Core
1.  Integrate local Whisper instance for stream transcription.
2.  Integrate OCR engine for frame text extraction.
3.  Establish local Vector Database and indexing pipeline.

### Phase 3: Orchestration
1.  Build the "Model Router" to switch between Local GGUF and Cloud API.
2.  Implement the prompt engine to accept user commands.

### Phase 4: Interface & Integration
1.  Develop the Stealth Overlay UI (transparent, click-through options).
2.  Implement Model Context Protocol (MCP) SDK basics.

## 6. Critical Technical Challenges
*   **Privacy:** Data must process locally by default. Cloud transmission requires explicit user intent.
*   **Performance:** Background capture must not degrade system FPS or cause CPU spikes.
*   **Synchronization:** Precise alignment between "what was seen" and "what was heard".

## 7. Cloud Provider Selection (MVP)
*   **Recommendation:** Google Cloud (Vertex AI).
*   **Reasoning:** High free tier availability, native multimodal processing (Gemini), cost-effective scaling.
*   **Alternative:** OpenRouter for rapid testing of multiple models (Claude, GPT, Llama) with a single interface.
