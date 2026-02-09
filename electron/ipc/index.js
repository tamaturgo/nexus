import { registerWindowHandlers } from "./handlers/windowHandlers.js";
import { registerContextHandlers } from "./handlers/contextHandlers.js";
import { registerAssistantHandlers } from "./handlers/assistantHandlers.js";
import { registerTranscriptionHandlers } from "./handlers/transcriptionHandlers.js";
import { registerSystemCaptureHandlers } from "./handlers/systemCaptureHandlers.js";
import { registerDesktopCaptureHandlers } from "./handlers/desktopCaptureHandlers.js";

export const registerHandlers = ({
  windowService,
  assistantService,
  transcriber,
  systemCaptureController
}) => {
  registerWindowHandlers(windowService);
  registerContextHandlers(windowService);
  registerAssistantHandlers(assistantService);
  registerTranscriptionHandlers(transcriber);
  registerSystemCaptureHandlers(systemCaptureController, windowService);
  registerDesktopCaptureHandlers();
};
