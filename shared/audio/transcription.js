export const sanitizeTranscriptionText = (text) => {
  if (!text || typeof text !== "string") return "";
  return text
    .replace(/\[[^\]]+\]/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .trim();
};
