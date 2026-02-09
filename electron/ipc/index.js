import { registerWindowHandlers } from "./handlers/windowHandlers.js";
import { registerContextHandlers } from "./handlers/contextHandlers.js";
import { registerAssistantHandlers } from "./handlers/assistantHandlers.js";
import { registerTranscriptionHandlers } from "./handlers/transcriptionHandlers.js";
import { registerSystemCaptureHandlers } from "./handlers/systemCaptureHandlers.js";
import { registerDesktopCaptureHandlers } from "./handlers/desktopCaptureHandlers.js";
import { registerSettingsHandlers } from "./handlers/settingsHandlers.js";
import { registerMemoryHandlers } from "./handlers/memoryHandlers.js";
import { registerContextHistoryHandlers } from "./handlers/contextHistoryHandlers.js";

export const registerHandlers = ({
  windowService,
  assistantService,
  transcriber,
  systemCaptureController,
  settingsStore,
  memoryService,
  contextHistoryStore
}) => {
  registerWindowHandlers(windowService);
  registerContextHandlers(windowService);
  registerAssistantHandlers(assistantService);
  registerTranscriptionHandlers(transcriber);
  registerSystemCaptureHandlers(systemCaptureController, windowService);
  registerDesktopCaptureHandlers();
  registerSettingsHandlers(settingsStore);
  registerMemoryHandlers(memoryService);
  registerContextHistoryHandlers(contextHistoryStore);
};
