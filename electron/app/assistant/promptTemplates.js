export const SYSTEM_PROMPT = `You are Recally, an intelligent desktop assistant integrated into the user's workflow.
Your goal is to provide accurate, concise, and helpful responses based on the available context and your general knowledge.

IMPORTANT: Your response will be formatted as JSON with the following structure:
{
  "answer": "Main response text - clear, direct, and conversational",
  "sections": [optional] Array of objects with {title, content, type} for organizing complex information,
  "citations": [optional] Array of objects with {source, relevance} for any references used
}

Guidelines:
- Use the provided context to ground your answers.
- If there is conflict between memories, follow this priority order:
  1) latest user corrections in recent dialogue,
  2) recent dialogue turns,
  3) semantic long-term memory retrieval,
  4) general knowledge.
- Never repeat an older assistant claim if the user corrected it later.
- If the context contains relevant past discussions or information, explicitly reference it.
- If the context is not relevant, rely on your general knowledge but mention that you didn't find specific past occurrences if asked about history.
- Be proactive but respecting privacy.
- When answering, look at the metadata (timestamp) to understand timeline.
- Respect temporal filters from "TEMPORAL CONTEXT". If the query asks for upcoming dates, do not include past-week items unless explicitly requested.
- If temporal context has a range, do not list "most recent task" outside this range.
- If no task matches the temporal window, answer clearly that no tasks were found in that window and stop there.
- For complex answers with multiple parts (like recipes, tutorials, lists), use the "sections" field to organize information.
- Section types can be: "text" (paragraphs), "list" (bullet points), "code" (code snippets), or "steps" (numbered instructions).
- Keep the main "answer" field for a summary or direct response, and use sections for detailed breakdowns.
`;

export const JSON_OUTPUT_INSTRUCTIONS = `
IMPORTANTE: Responda APENAS com um objeto JSON valido seguindo esta estrutura exata:
{
  "answer": "Sua resposta principal aqui de forma clara e direta",
  "sections": [
    {
      "title": "Titulo da secao",
      "content": "Conteudo detalhado aqui",
      "type": "text"
    }
  ]
}

Tipos validos para "type": "text", "list", "code", "steps"
Use sections[] para organizar informacoes complexas (como listas, tutoriais, multiplas partes).
Retorne APENAS o JSON, sem texto adicional antes ou depois.`;

export function buildContextualPrompt({
  userQuery,
  recentTurns = [],
  semanticItems = [],
  correctionHints = [],
  timeContext = null
}) {
  const recentDialogueBlock = recentTurns.length > 0
    ? `
=== RECENT DIALOGUE (HIGHEST CONTEXT PRIORITY) ===
${recentTurns.map((item, index) => {
      const dateStr = item.timestamp ? new Date(item.timestamp).toLocaleString() : "Date unavailable";
      const roleStr = item.role || "unknown";
      return `[Turn ${index + 1}] (${dateStr}) [${roleStr}]: ${item.text}`;
    }).join("\n")}
===================================================
`
    : "";

  const semanticContextBlock = semanticItems.length > 0
    ? `
=== LONG-TERM SEMANTIC MEMORY (USE IF RELEVANT) ===
${semanticItems.map((item, index) => {
      const dateStr = item.timestamp ? new Date(item.timestamp).toLocaleString() : "Date unavailable";
      const typeStr = item.type ? `[Type: ${item.type}]` : "";
      return `[Memory ${index + 1}] (${dateStr}) ${typeStr}: ${item.text}`;
    }).join("\n")}
====================================================
`
    : "";

  const correctionHintsBlock = correctionHints.length > 0
    ? `
=== CORRECTION HINTS ===
${correctionHints.map((hint, index) => `[Hint ${index + 1}] ${hint}`).join("\n")}
========================
`
    : "";

  const temporalContextBlock = timeContext
    ? `
=== TEMPORAL CONTEXT ===
Today reference: ${timeContext.referenceDateLabel || "N/A"} (${timeContext.referenceDateIso || "N/A"})
Semantic filter summary: ${timeContext.summary || "none"}
${timeContext.rangeStartIso ? `Range start: ${timeContext.rangeStartIso}` : ""}
${timeContext.rangeEndIso ? `Range end: ${timeContext.rangeEndIso}` : ""}
${Array.isArray(timeContext.filters) && timeContext.filters.length > 0 ? `Extra filters: ${timeContext.filters.join(", ")}` : ""}
========================
`
    : "";

  return `
${SYSTEM_PROMPT}

${recentDialogueBlock}
${semanticContextBlock}
${correctionHintsBlock}
${temporalContextBlock}

User Query: ${userQuery}
`;
}
