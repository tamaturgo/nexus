const UPDATE_CONFIDENCE_THRESHOLD = 0.85;
const UPDATE_SIMILARITY_THRESHOLD = 0.3;

const NOTE_TYPES = new Set(["note", "task", "idea", "reference"]);
const NOTE_PRIORITIES = new Set(["low", "medium", "high"]);
const NOTE_SOURCES = new Set(["text", "audio"]);
const TASK_VERB_HINT = /\b(preciso|lembrar|tenho que|devo|fazer|entregar|comprar|agendar|enviar|pagar|confirmar|reservar)\b/i;
const WEEKDAY_INDEX = new Map([
  ["domingo", 0],
  ["segunda", 1],
  ["segunda-feira", 1],
  ["segunda feira", 1],
  ["terca", 2],
  ["terca-feira", 2],
  ["terca feira", 2],
  ["quarta", 3],
  ["quarta-feira", 3],
  ["quarta feira", 3],
  ["quinta", 4],
  ["quinta-feira", 4],
  ["quinta feira", 4],
  ["sexta", 5],
  ["sexta-feira", 5],
  ["sexta feira", 5],
  ["sabado", 6]
]);

const normalizeString = (value, fallback = "") => {
  if (typeof value !== "string") return fallback;
  return value.trim();
};

const normalizeReferenceDate = (value) => {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value;
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed > 0) {
    const candidate = new Date(parsed);
    if (Number.isFinite(candidate.getTime())) return candidate;
  }
  return new Date();
};

const stripAccents = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const toIsoDate = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
};

const fromIsoDate = (value) => {
  const text = normalizeString(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const [yearText, monthText, dayText] = text.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const parsed = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (
    parsed.getFullYear() !== year
    || parsed.getMonth() !== month - 1
    || parsed.getDate() !== day
  ) {
    return null;
  }
  return parsed;
};

const toEndOfDayTimestamp = (isoDate) => {
  const parsed = fromIsoDate(isoDate);
  if (!parsed) return null;
  const endOfDay = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 23, 59, 59, 999);
  return endOfDay.getTime();
};

const toDisplayDate = (isoDate) => {
  const parsed = fromIsoDate(isoDate);
  if (!parsed) return "";
  return parsed.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
};

const normalizeDueDate = (value, referenceDate = new Date()) => {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return toIsoDate(new Date(value));
  }

  const text = normalizeString(value);
  if (!text) return "";

  const parsedAbsolute = fromIsoDate(text);
  if (parsedAbsolute) return toIsoDate(parsedAbsolute);

  const inferred = inferDueDateFromText(text, referenceDate).dueDateIso;
  if (inferred) return inferred;

  return "";
};

const normalizeTags = (value) => {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const tags = [];
  for (const entry of value) {
    const tag = normalizeString(entry);
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
  }
  return tags;
};

const normalizeType = (value) => {
  const lower = normalizeString(value, "note").toLowerCase();
  return NOTE_TYPES.has(lower) ? lower : "note";
};

const normalizePriority = (value) => {
  const lower = normalizeString(value, "medium").toLowerCase();
  return NOTE_PRIORITIES.has(lower) ? lower : "medium";
};

const normalizeSource = (value) => {
  const lower = normalizeString(value, "text").toLowerCase();
  return NOTE_SOURCES.has(lower) ? lower : "text";
};

const normalizeOptionalSource = (value) => {
  const lower = normalizeString(value).toLowerCase();
  return NOTE_SOURCES.has(lower) ? lower : "";
};

const normalizeConfidence = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(1, parsed));
};

const normalizeTemporalExpression = (text) =>
  stripAccents(String(text || ""))
    .toLowerCase()
    .replace(/[.,;!?]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const resolveRelativeWeekday = (referenceDate, weekdayIndex, { strictFuture = false } = {}) => {
  const base = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
    12,
    0,
    0,
    0
  );
  const today = base.getDay();
  let delta = weekdayIndex - today;
  if (delta < 0) delta += 7;
  if (strictFuture && delta === 0) delta = 7;
  const resolved = new Date(base);
  resolved.setDate(base.getDate() + delta);
  return resolved;
};

const resolveNextMonday = (referenceDate) => {
  const base = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
    12,
    0,
    0,
    0
  );
  const currentWeekday = base.getDay();
  const delta = ((8 - currentWeekday) % 7) || 7;
  const nextMonday = new Date(base);
  nextMonday.setDate(base.getDate() + delta);
  return nextMonday;
};

const resolveUpcomingSaturday = (referenceDate) => {
  const base = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
    12,
    0,
    0,
    0
  );
  const currentWeekday = base.getDay();
  let delta = 6 - currentWeekday;
  if (delta < 0) delta += 7;
  const saturday = new Date(base);
  saturday.setDate(base.getDate() + delta);
  return saturday;
};

const parseAbsoluteDateFromText = (normalizedText, referenceDate) => {
  const isoMatch = normalizedText.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  if (isoMatch) {
    const isoCandidate = `${isoMatch[1]}-${String(Number(isoMatch[2])).padStart(2, "0")}-${String(Number(isoMatch[3])).padStart(2, "0")}`;
    const parsedIso = fromIsoDate(isoCandidate);
    if (parsedIso) {
      return { dueDateIso: toIsoDate(parsedIso), reason: "iso-date" };
    }
  }

  const brMatch = normalizedText.match(/\b([0-3]?\d)[\/\-]([0-1]?\d)(?:[\/\-](\d{2,4}))?\b/);
  if (!brMatch) return null;

  const day = Number(brMatch[1]);
  const month = Number(brMatch[2]);
  if (month < 1 || month > 12) return null;

  const yearInput = brMatch[3] ? Number(brMatch[3]) : referenceDate.getFullYear();
  const year = brMatch[3] && String(brMatch[3]).length <= 2 ? 2000 + yearInput : yearInput;
  const parsed = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (
    parsed.getFullYear() !== year
    || parsed.getMonth() !== month - 1
    || parsed.getDate() !== day
  ) {
    return null;
  }

  if (!brMatch[3]) {
    const today = new Date(
      referenceDate.getFullYear(),
      referenceDate.getMonth(),
      referenceDate.getDate(),
      0,
      0,
      0,
      0
    );
    if (parsed < today) {
      parsed.setFullYear(parsed.getFullYear() + 1);
    }
  }

  return { dueDateIso: toIsoDate(parsed), reason: "br-date" };
};

const parseDateToken = (token, referenceDate) => {
  const text = normalizeString(token);
  if (!text) return "";

  const isoMatch = text.match(/^(20\d{2})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const isoCandidate = `${isoMatch[1]}-${String(Number(isoMatch[2])).padStart(2, "0")}-${String(Number(isoMatch[3])).padStart(2, "0")}`;
    const parsedIso = fromIsoDate(isoCandidate);
    return parsedIso ? toIsoDate(parsedIso) : "";
  }

  const brMatch = text.match(/^([0-3]?\d)[\/\-]([0-1]?\d)(?:[\/\-](\d{2,4}))?$/);
  if (!brMatch) return "";

  const day = Number(brMatch[1]);
  const month = Number(brMatch[2]);
  if (month < 1 || month > 12) return "";

  const yearInput = brMatch[3] ? Number(brMatch[3]) : referenceDate.getFullYear();
  const year = brMatch[3] && String(brMatch[3]).length <= 2 ? 2000 + yearInput : yearInput;
  const parsed = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (
    parsed.getFullYear() !== year
    || parsed.getMonth() !== month - 1
    || parsed.getDate() !== day
  ) {
    return "";
  }

  if (!brMatch[3]) {
    const today = new Date(
      referenceDate.getFullYear(),
      referenceDate.getMonth(),
      referenceDate.getDate(),
      0,
      0,
      0,
      0
    );
    if (parsed < today) {
      parsed.setFullYear(parsed.getFullYear() + 1);
    }
  }

  return toIsoDate(parsed);
};

const hasDeadlineSignal = (normalizedText) =>
  /\b(ate|ateh|prazo|deadline|entrega|entregar|vencimento|vence|due)\b/.test(normalizedText);

const hasPastActionSignal = (normalizedText) =>
  /\b(comecei|iniciei|retomei|voltei|foi|aconteceu|passou|fiz|conclui|finalizei|terminei|estive|tive)\b/.test(normalizedText);

const mentionsAnyWeekday = (normalizedText) =>
  /\b(segunda(?:-feira| feira)?|terca(?:-feira| feira)?|quarta(?:-feira| feira)?|quinta(?:-feira| feira)?|sexta(?:-feira| feira)?|sabado|domingo)\b/.test(normalizedText);

const resolveWeekdayWithModifier = (referenceDate, weekday, modifier = "") => {
  const weekdayIndex = WEEKDAY_INDEX.get(weekday);
  if (typeof weekdayIndex !== "number") return "";
  const normalizedModifier = normalizeString(modifier).toLowerCase();
  const preferPast = normalizedModifier === "passada"
    || normalizedModifier === "passado"
    || normalizedModifier === "ultima"
    || normalizedModifier === "ultimo";
  const strictFuture = normalizedModifier === "proxima" || normalizedModifier === "proximo";
  const resolved = resolveRelativeWeekday(referenceDate, weekdayIndex, {
    strictFuture
  });
  if (!preferPast) return toIsoDate(resolved);

  const base = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
    12,
    0,
    0,
    0
  );
  let delta = base.getDay() - weekdayIndex;
  if (delta < 0) delta += 7;
  if (delta === 0) delta = 7;
  const previous = new Date(base);
  previous.setDate(base.getDate() - delta);
  return toIsoDate(previous);
};

const parseDeadlineDateFromText = (normalizedText, referenceDate) => {
  if (!hasDeadlineSignal(normalizedText)) return "";

  const dateDeadlineMatch = normalizedText.match(
    /\b(?:ate|ateh|prazo|deadline|entrega|entregar|vencimento|vence|due)\b[^0-9a-z]{0,8}(20\d{2}-\d{1,2}-\d{1,2}|[0-3]?\d[\/\-][0-1]?\d(?:[\/\-]\d{2,4})?)\b/
  );
  if (dateDeadlineMatch?.[1]) {
    const parsed = parseDateToken(dateDeadlineMatch[1], referenceDate);
    if (parsed) return parsed;
  }

  const weekdayDeadlineMatch = normalizedText.match(
    /\b(?:ate|ateh|prazo|deadline|entrega|entregar|vencimento|vence|due)\b[^a-z0-9]{0,8}(?:(proxima|proximo|passada|passado|ultima|ultimo|esta|essa)\s+)?(segunda(?:-feira| feira)?|terca(?:-feira| feira)?|quarta(?:-feira| feira)?|quinta(?:-feira| feira)?|sexta(?:-feira| feira)?|sabado|domingo)\b/
  );
  if (weekdayDeadlineMatch) {
    const modifier = normalizeString(weekdayDeadlineMatch[1]).toLowerCase();
    const weekday = normalizeString(weekdayDeadlineMatch[2]).toLowerCase().replace(/\s+/g, " ");
    const parsed = resolveWeekdayWithModifier(referenceDate, weekday, modifier);
    if (parsed) return parsed;
  }

  return "";
};

const inferDueDateFromText = (text, referenceDate = new Date()) => {
  const normalized = normalizeTemporalExpression(text);
  if (!normalized) return { dueDateIso: "", reason: "" };

  const deadlineDueDateIso = parseDeadlineDateFromText(normalized, referenceDate);
  if (deadlineDueDateIso) {
    return { dueDateIso: deadlineDueDateIso, reason: "deadline-signal" };
  }

  const hasPastOnlyTimeline = hasPastActionSignal(normalized) && !hasDeadlineSignal(normalized);
  if (hasPastOnlyTimeline && mentionsAnyWeekday(normalized)) {
    return { dueDateIso: "", reason: "past-event-weekday" };
  }

  const absoluteMatch = parseAbsoluteDateFromText(normalized, referenceDate);
  if (absoluteMatch) return absoluteMatch;

  if (/\bdepois de amanh[ae]\b/.test(normalized)) {
    const resolved = new Date(referenceDate);
    resolved.setDate(resolved.getDate() + 2);
    return { dueDateIso: toIsoDate(resolved), reason: "depois-de-amanha" };
  }

  if (/\bamanh[ae]\b/.test(normalized)) {
    const resolved = new Date(referenceDate);
    resolved.setDate(resolved.getDate() + 1);
    return { dueDateIso: toIsoDate(resolved), reason: "amanha" };
  }

  if (/\bhoje\b/.test(normalized)) {
    return { dueDateIso: toIsoDate(referenceDate), reason: "hoje" };
  }

  if (/\b(proxima|proximo)\s+semana\b|\bsemana\s+que\s+vem\b/.test(normalized)) {
    const resolved = resolveNextMonday(referenceDate);
    return { dueDateIso: toIsoDate(resolved), reason: "proxima-semana" };
  }

  if (/\b(fim de semana|final de semana)\b/.test(normalized)) {
    const resolved = resolveUpcomingSaturday(referenceDate);
    return { dueDateIso: toIsoDate(resolved), reason: "fim-de-semana" };
  }

  const weekdayMatch = normalized.match(
    /\b(?:(?:na|no|ate|ateh|em|para|pra|nesta|nessa|esta)\s+)?(?:(proxima|proximo|passada|passado|ultima|ultimo|esta|nessa|nesta)\s+)?(segunda(?:-feira| feira)?|terca(?:-feira| feira)?|quarta(?:-feira| feira)?|quinta(?:-feira| feira)?|sexta(?:-feira| feira)?|sabado|domingo)\b/
  );
  if (weekdayMatch) {
    const modifier = normalizeString(weekdayMatch[1]).toLowerCase();
    const weekday = normalizeString(weekdayMatch[2]).toLowerCase().replace(/\s+/g, " ");
    const resolved = resolveWeekdayWithModifier(referenceDate, weekday, modifier);
    if (resolved) {
      return { dueDateIso: resolved, reason: `weekday-${weekday}` };
    }
  }

  return { dueDateIso: "", reason: "" };
};

const stripCodeFence = (text) => {
  let normalized = normalizeString(text);
  if (normalized.startsWith("```json")) {
    normalized = normalized.replace(/^```json\s*/i, "").replace(/\s*```$/, "");
  } else if (normalized.startsWith("```")) {
    normalized = normalized.replace(/^```\s*/i, "").replace(/\s*```$/, "");
  }
  return normalized.trim();
};

const normalizeSmartQuotes = (value) => String(value || "")
  .replace(/[\u201c\u201d]/g, "\"")
  .replace(/[\u2018\u2019]/g, "'");

const removeTrailingCommas = (value) => String(value || "").replace(/,\s*([}\]])/g, "$1");

const escapeInvalidControlCharsInStrings = (value) => {
  const text = String(value || "");
  let result = "";
  let inString = false;
  let escaped = false;

  for (let index = 0; index < text.length; index += 1) {
    const ch = text[index];

    if (!inString) {
      if (ch === "\"") {
        inString = true;
      }
      result += ch;
      continue;
    }

    if (escaped) {
      result += ch;
      escaped = false;
      continue;
    }

    if (ch === "\\") {
      result += ch;
      escaped = true;
      continue;
    }

    if (ch === "\"") {
      inString = false;
      result += ch;
      continue;
    }

    if (ch === "\n") {
      result += "\\n";
      continue;
    }

    if (ch === "\r") {
      result += "\\r";
      continue;
    }

    if (ch === "\t") {
      result += "\\t";
      continue;
    }

    const code = ch.charCodeAt(0);
    if (code >= 0 && code <= 0x1f) {
      result += "\\u" + code.toString(16).padStart(4, "0");
      continue;
    }

    result += ch;
  }

  return result;
};

const extractFirstJsonObject = (value) => {
  const text = String(value || "");
  const firstBrace = text.indexOf("{");
  if (firstBrace < 0) return text;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = firstBrace; index < text.length; index += 1) {
    const ch = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === "\"") {
        inString = false;
      }
      continue;
    }

    if (ch === "\"") {
      inString = true;
      continue;
    }

    if (ch === "{") depth += 1;
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        return text.slice(firstBrace, index + 1);
      }
    }
  }

  return text.slice(firstBrace);
};

const tryParseJson = (value) => {
  const normalized = normalizeSmartQuotes(stripCodeFence(value));
  const candidates = [
    normalized,
    extractFirstJsonObject(normalized),
    removeTrailingCommas(normalized),
    removeTrailingCommas(extractFirstJsonObject(normalized)),
    escapeInvalidControlCharsInStrings(removeTrailingCommas(normalized)),
    escapeInvalidControlCharsInStrings(removeTrailingCommas(extractFirstJsonObject(normalized)))
  ];

  let lastError = null;
  for (const candidate of candidates) {
    if (!candidate || !candidate.trim()) continue;
    try {
      return JSON.parse(candidate);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("Unable to parse classification JSON.");
};

const mergeTags = (...groups) => {
  const seen = new Set();
  const merged = [];
  for (const group of groups) {
    for (const tag of normalizeTags(group)) {
      const key = tag.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(tag);
    }
  }
  return merged;
};

const normalizeTitleText = (value) =>
  normalizeString(value)
    .replace(/^\s{0,3}#{1,6}\s+/g, "")
    .replace(/^[-*]\s+\[[ xX]\]\s+/g, "")
    .replace(/\s+/g, " ")
    .trim();

const makeFallbackTitle = (text) => {
  const cleaned = normalizeTitleText(normalizeString(text));
  if (!cleaned) return "Nota rapida";
  const firstSentence = cleaned.split(/[.!?\n]/)[0]?.trim() || cleaned;
  if (firstSentence.length <= 72) return firstSentence;
  return `${firstSentence.slice(0, 69)}...`;
};

const tokenizeForMatch = (value) =>
  normalizeTemporalExpression(value)
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);

const TOKEN_STOPWORDS = new Set([
  "que",
  "para",
  "com",
  "sem",
  "uma",
  "uns",
  "das",
  "dos",
  "the",
  "and",
  "this",
  "that",
  "book",
  "unit",
  "curso",
  "aula",
  "homework"
]);

const tokenizeForSemanticMatch = (value) =>
  tokenizeForMatch(value).filter((token) => !TOKEN_STOPWORDS.has(token));

const overlapCoefficient = (leftTokens, rightTokens) => {
  const left = new Set(leftTokens);
  const right = new Set(rightTokens);
  if (!left.size || !right.size) return 0;

  let intersection = 0;
  for (const token of left) {
    if (right.has(token)) intersection += 1;
  }

  const denominator = Math.min(left.size, right.size);
  if (!denominator) return 0;
  return intersection / denominator;
};

const noteDueDateIso = (note) => {
  const dueAt = Number(note?.dueAt);
  if (!Number.isFinite(dueAt) || dueAt <= 0) return "";
  return toIsoDate(new Date(dueAt));
};

const escapeForPrompt = (value) => String(value || "").replace(/\r/g, " ").replace(/\n/g, " ").trim();

const shouldSuggestMermaid = (text) => {
  const normalized = normalizeTemporalExpression(text);
  const hints = ["fluxo", "processo", "pipeline", "arquitetura", "etapa", "roadmap", "timeline", "sequencia", "dependencia"];
  return hints.some((hint) => normalized.includes(hint));
};

const normalizeMarkdown = (value) => normalizeString(value).replace(/\r\n/g, "\n");

const extractKeyLines = (text, max = 4) =>
  normalizeString(text)
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, max);

const deriveChecklistItems = (text) => {
  const sentenceCandidates = normalizeString(text)
    .split(/[.;\n]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item.replace(/^(eu\s+)?(preciso|tenho que|devo|lembrar(?:\s+de)?|quero)\s+/i, "").trim())
    .filter(Boolean)
    .slice(0, 3);

  if (!sentenceCandidates.length) {
    return [
      "- [ ] Revisar esta nota",
      "- [ ] Definir a proxima acao"
    ];
  }

  return sentenceCandidates.map((item) => `- [ ] ${item.charAt(0).toUpperCase()}${item.slice(1)}`);
};

const hasChecklist = (markdown) => /(^|\n)-\s\[( |x|X)\]\s+/m.test(markdown);

const hasMermaid = (markdown) => /```mermaid[\s\S]*?```/i.test(markdown);

const buildDueDateBlock = (dueDateIso) => {
  if (!dueDateIso) return "";
  const label = toDisplayDate(dueDateIso) || dueDateIso;
  return `### Prazo sugerido\n- Conclusao: **${label}** (${dueDateIso})`;
};

const buildFallbackMarkdown = (text, { title = "", type = "note", dueDateIso = "" } = {}) => {
  const cleaned = normalizeString(text);
  const resolvedTitle = normalizeString(title) || makeFallbackTitle(cleaned);
  const keyLines = extractKeyLines(cleaned);
  const bullets = (keyLines.length ? keyLines : [cleaned || "Captura rapida"]).map((line) => `- ${line}`).join("\n");
  const checklist = deriveChecklistItems(cleaned).join("\n");

  const sections = [
    `## ${resolvedTitle}`,
    "",
    "### Contexto",
    bullets,
    "",
    "### Proximos passos",
    checklist
  ];

  if (dueDateIso) {
    sections.push("", buildDueDateBlock(dueDateIso));
  }

  if (type === "task" || TASK_VERB_HINT.test(cleaned)) {
    sections.push("", "### Status", "- [ ] Em andamento");
  }

  if (shouldSuggestMermaid(cleaned)) {
    sections.push(
      "",
      "### Fluxo sugerido (Mermaid)",
      "```mermaid",
      "flowchart TD",
      "    A[Entrada] --> B[Organizar ideia]",
      "    B --> C[Executar proximo passo]",
      "```"
    );
  }

  return sections.join("\n").trim();
};

const boostMarkdown = (markdownBody, { text, title, type, dueDateIso }) => {
  let body = normalizeMarkdown(markdownBody);
  if (!body) {
    return buildFallbackMarkdown(text, { title, type, dueDateIso });
  }

  const headingPattern = /^\s{0,3}#{1,3}\s+/m;
  if (!headingPattern.test(body)) {
    const resolvedTitle = normalizeString(title) || makeFallbackTitle(text);
    body = `## ${resolvedTitle}\n\n${body}`;
  }

  const needsChecklist = (type === "task" || TASK_VERB_HINT.test(text)) && !hasChecklist(body);
  if (needsChecklist) {
    body = `${body.trim()}\n\n### Checklist\n${deriveChecklistItems(text).join("\n")}`;
  }

  if (dueDateIso && !/prazo|conclusao|deadline/i.test(stripAccents(body).toLowerCase())) {
    body = `${body.trim()}\n\n${buildDueDateBlock(dueDateIso)}`;
  }

  if (shouldSuggestMermaid(`${text}\n${body}`) && !hasMermaid(body)) {
    body = `${body.trim()}\n\n### Fluxo sugerido (Mermaid)\n\`\`\`mermaid\nflowchart TD\n    A[Entrada] --> B[Estruturar nota]\n    B --> C[Acao]\n\`\`\``;
  }

  return body.trim();
};

const resolveFinalDueDateIso = ({
  classificationDueDate,
  detectedDueDateIso,
  text,
  referenceDate
}) => {
  const fromModelIso = normalizeDueDate(classificationDueDate, referenceDate);
  if (fromModelIso) return fromModelIso;

  const modelRelative = inferDueDateFromText(classificationDueDate, referenceDate).dueDateIso;
  if (modelRelative) return modelRelative;

  if (detectedDueDateIso) return detectedDueDateIso;

  return inferDueDateFromText(text, referenceDate).dueDateIso || "";
};

const createJobId = () => `note-job-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export class NoteService {
  constructor({ noteStore, aiClient, settingsStore, vectorStore }) {
    this.noteStore = noteStore;
    this.aiClient = aiClient;
    this.settingsStore = settingsStore;
    this.vectorStore = vectorStore;

    this.quickNoteQueue = [];
    this.isQueueProcessing = false;
    this.jobHistory = new Map();
    this.maxJobHistory = 200;
  }

  listNotes() {
    return this.noteStore.list();
  }

  getNote(noteId) {
    return this.noteStore.get(noteId);
  }

  createNote(payload = {}) {
    const isCompleted = Boolean(payload.isCompleted);
    const note = this.noteStore.create({
      ...payload,
      isCompleted,
      completedAt: isCompleted
        ? Number(payload.completedAt) || Date.now()
        : null
    });
    this.indexNoteSnapshot(note);
    return note;
  }

  updateNote(noteId, patch = {}) {
    const existing = this.noteStore.get(noteId);
    if (!existing) return null;

    const hasCompletedFlag = Object.prototype.hasOwnProperty.call(patch || {}, "isCompleted");
    const isCompleted = hasCompletedFlag ? Boolean(patch.isCompleted) : Boolean(existing.isCompleted);
    const completedAt = isCompleted
      ? (Number(patch.completedAt) || Number(existing.completedAt) || Date.now())
      : null;

    const note = this.noteStore.update(noteId, {
      ...patch,
      isCompleted,
      completedAt
    });

    if (note) {
      this.indexNoteSnapshot(note);
    }

    return note;
  }

  deleteNote(noteId) {
    return this.noteStore.remove(noteId);
  }

  enqueueQuickNote(payload = {}) {
    const text = normalizeString(payload.text);
    const source = normalizeSource(payload.source);

    if (!text) {
      return {
        ok: false,
        queued: false,
        message: "Texto vazio. Nada para enfileirar."
      };
    }

    const job = {
      jobId: createJobId(),
      payload: { text, source },
      status: "queued",
      queuedAt: Date.now()
    };

    this.quickNoteQueue.push(job);
    this.rememberJob(job);
    this.drainQuickNoteQueue().catch((error) => {
      console.error("NoteService: quick note queue failed:", error);
    });

    const queueSize = this.quickNoteQueue.length + (this.isQueueProcessing ? 1 : 0);
    return {
      ok: true,
      queued: true,
      jobId: job.jobId,
      queueSize,
      message: queueSize > 1
        ? `Quick note enviada para fila (${queueSize} pendentes).`
        : "Quick note enviada para fila."
    };
  }

  async drainQuickNoteQueue() {
    if (this.isQueueProcessing) return;
    this.isQueueProcessing = true;

    while (this.quickNoteQueue.length > 0) {
      const job = this.quickNoteQueue.shift();
      if (!job) continue;

      this.rememberJob({
        ...job,
        status: "processing",
        startedAt: Date.now()
      });

      try {
        const result = await this.processQuickNote(job.payload);
        this.rememberJob({
          ...job,
          status: result?.ok ? "done" : "failed",
          completedAt: Date.now(),
          result
        });
      } catch (error) {
        console.error("NoteService: quick note processing error", error);
        this.rememberJob({
          ...job,
          status: "failed",
          completedAt: Date.now(),
          error: error?.message || String(error)
        });
      }
    }

    this.isQueueProcessing = false;
  }

  rememberJob(job) {
    if (!job?.jobId) return;
    this.jobHistory.set(job.jobId, job);
    if (this.jobHistory.size <= this.maxJobHistory) return;
    const oldest = this.jobHistory.keys().next().value;
    if (oldest) {
      this.jobHistory.delete(oldest);
    }
  }

  findDeterministicUpdateCandidate({
    candidates = [],
    text = "",
    resolvedTitle = "",
    resolvedDueDateIso = ""
  } = {}) {
    if (!Array.isArray(candidates) || !candidates.length) return null;

    const inputTitle = normalizeTitleText(resolvedTitle || makeFallbackTitle(text));
    const inputTitleTokens = tokenizeForMatch(inputTitle);
    const inputTextTokens = tokenizeForMatch(text);
    const inputSemanticTokens = tokenizeForSemanticMatch(`${inputTitle}\n${text}`);

    let best = null;
    for (const candidate of candidates) {
      const note = candidate?.note;
      if (!note?.id) continue;

      const noteTitleTokens = tokenizeForMatch(note.title);
      const noteSemanticTokens = tokenizeForSemanticMatch(`${note.title}\n${String(note.body || "").slice(0, 1600)}`);
      const titleOverlap = overlapCoefficient(inputTitleTokens, noteTitleTokens);
      const queryTitleOverlap = overlapCoefficient(inputTextTokens, noteTitleTokens);
      const semanticOverlap = overlapCoefficient(inputSemanticTokens, noteSemanticTokens);
      const lexicalSimilarity = Number(candidate.similarity) || 0;
      const dueIso = noteDueDateIso(note);
      const dueAligned = Boolean(resolvedDueDateIso) && dueIso === resolvedDueDateIso;
      const score = (
        titleOverlap * 0.35
        + queryTitleOverlap * 0.2
        + semanticOverlap * 0.3
        + lexicalSimilarity * 0.1
        + (dueAligned ? 0.05 : 0)
      );

      if (!dueAligned) {
        continue;
      }

      const isStrongTitleMatch = titleOverlap >= 0.78 || queryTitleOverlap >= 0.78;
      const isDeterministicMatch = (
        (
          titleOverlap >= 0.62
          || queryTitleOverlap >= 0.62
          || semanticOverlap >= 0.45
          || lexicalSimilarity >= 0.55
          || isStrongTitleMatch
        )
        && (lexicalSimilarity >= 0.08 || semanticOverlap >= 0.24 || isStrongTitleMatch)
      );

      if (!isDeterministicMatch) {
        continue;
      }

      if (!best || score > best.score) {
        best = {
          ...candidate,
          score,
          dueAligned,
          titleOverlap,
          queryTitleOverlap,
          semanticOverlap
        };
      }
    }

    return best;
  }

  async processQuickNote(payload = {}) {
    const text = normalizeString(payload.text);
    const source = normalizeSource(payload.source);
    const referenceDate = normalizeReferenceDate(payload.referenceTime);

    if (!text) {
      return {
        ok: false,
        operation: null,
        note: null,
        message: "Texto vazio. Nada para processar."
      };
    }

    const inferredTemporal = inferDueDateFromText(text, referenceDate);
    const detectedDueDateIso = normalizeDueDate(inferredTemporal.dueDateIso, referenceDate);
    const candidates = this.noteStore.findCandidatesBySimilarity(text, { limit: 6 });
    const classification = await this.classifyQuickNoteWithFallback(text, candidates, {
      referenceDate,
      detectedDueDateIso
    });

    const resolvedTitle = normalizeString(classification.title) || makeFallbackTitle(text);
    const resolvedType = normalizeType(classification.type);
    const resolvedDueDateIso = resolveFinalDueDateIso({
      classificationDueDate: classification.dueDate,
      detectedDueDateIso,
      text,
      referenceDate
    });
    const resolvedDueAt = toEndOfDayTimestamp(resolvedDueDateIso);
    const dueTag = resolvedDueDateIso ? `prazo:${resolvedDueDateIso}` : "";

    const targetCandidate = candidates.find(
      (entry) => entry.note.id === normalizeString(classification.targetNoteId)
    );
    const deterministicCandidate = this.findDeterministicUpdateCandidate({
      candidates,
      text,
      resolvedTitle,
      resolvedDueDateIso
    });
    const shouldUpdate = (
      classification.operation === "update"
      && classification.confidence >= UPDATE_CONFIDENCE_THRESHOLD
      && targetCandidate
      && targetCandidate.similarity >= UPDATE_SIMILARITY_THRESHOLD
    );
    const shouldUpdateDeterministically = (
      !shouldUpdate
      && deterministicCandidate
      && deterministicCandidate.note
      && deterministicCandidate.score >= 0.62
    );
    const selectedUpdateCandidate = shouldUpdate
      ? targetCandidate
      : (shouldUpdateDeterministically ? deterministicCandidate : null);

    let note;
    let operation;

    if (selectedUpdateCandidate) {
      const existing = this.noteStore.get(selectedUpdateCandidate.note.id);
      if (existing) {
        const existingDueIso = existing.dueAt ? toIsoDate(new Date(existing.dueAt)) : "";
        const dueDateForUpdate = resolvedDueDateIso || existingDueIso;
        const appendText = boostMarkdown(
          classification.markdownBody || classification.bodyAppend || "",
          {
            text,
            title: resolvedTitle || existing.title,
            type: resolvedType || existing.type,
            dueDateIso: dueDateForUpdate
          }
        );
        const stamp = new Date().toLocaleString("pt-BR");
        const updateSuffix = dueDateForUpdate ? ` | prazo ${dueDateForUpdate}` : "";
        const updateSection = `## Update (${stamp}${updateSuffix})\n\n${appendText}`;
        const mergedBody = existing.body
          ? `${existing.body}\n\n---\n\n${updateSection}`
          : updateSection;

        note = this.noteStore.update(existing.id, {
          title: resolvedTitle || existing.title,
          body: mergedBody,
          type: normalizeType(classification.type || existing.type || resolvedType),
          priority: this.noteStore.mergePriority(existing.priority, classification.priority),
          tags: mergeTags(existing.tags, classification.tags, dueTag ? [dueTag] : []),
          dueAt: resolvedDueAt || existing.dueAt || null,
          source: normalizeSource(classification.source || source)
        });
        operation = "updated";
      }
    }

    if (!note) {
      const body = boostMarkdown(
        classification.markdownBody || classification.bodyAppend || "",
        {
          text,
          title: resolvedTitle,
          type: resolvedType,
          dueDateIso: resolvedDueDateIso
        }
      );
      note = this.noteStore.create({
        title: resolvedTitle,
        body,
        type: resolvedType,
        priority: normalizePriority(classification.priority),
        tags: mergeTags(classification.tags, dueTag ? [dueTag] : []),
        dueAt: resolvedDueAt,
        isCompleted: false,
        completedAt: null,
        source: normalizeSource(classification.source || source)
      });
      operation = "created";
    }

    await this.indexNoteSnapshot(note);

    return {
      ok: true,
      operation,
      note,
      message: operation === "updated"
        ? (resolvedDueDateIso
          ? `Nota existente atualizada automaticamente (prazo ${resolvedDueDateIso}).`
          : "Nota existente atualizada automaticamente.")
        : (resolvedDueDateIso
          ? `Nova nota criada com prazo ${resolvedDueDateIso}.`
          : "Nova nota criada.")
    };
  }

  async classifyQuickNoteWithFallback(text, candidates, temporalContext = {}) {
    const referenceDate = normalizeReferenceDate(temporalContext.referenceDate);
    const detectedDueDateIso = normalizeDueDate(temporalContext.detectedDueDateIso, referenceDate);
    const fallbackType = TASK_VERB_HINT.test(text) ? "task" : "note";
    const fallbackTitle = makeFallbackTitle(text);
    const fallback = {
      operation: "create",
      confidence: 0,
      targetNoteId: "",
      title: fallbackTitle,
      bodyAppend: text,
      markdownBody: buildFallbackMarkdown(text, {
        title: fallbackTitle,
        type: fallbackType,
        dueDateIso: detectedDueDateIso
      }),
      dueDate: detectedDueDateIso,
      type: fallbackType,
      priority: "medium",
      tags: [],
      source: ""
    };

    if (!this.aiClient?.generateText) {
      return fallback;
    }

    try {
      const prompt = this.buildClassificationPrompt(text, candidates, {
        referenceDate,
        detectedDueDateIso
      });
      const aiSettings = this.settingsStore?.getSettings?.().ai || {};
      const raw = await this.aiClient.generateText(prompt, {
        provider: aiSettings.provider,
        model: aiSettings.model,
        temperature: typeof aiSettings.temperature === "number"
          ? Math.min(0.4, Math.max(0, aiSettings.temperature))
          : 0.2,
        maxOutputTokens: 1100
      });
      const parsed = this.normalizeClassificationResponse(raw);
      return {
        ...fallback,
        ...parsed
      };
    } catch (error) {
      console.error("NoteService: quick note classification failed, using fallback", error);
      return fallback;
    }
  }

  buildClassificationPrompt(text, candidates = [], temporalContext = {}) {
    const referenceDate = normalizeReferenceDate(temporalContext.referenceDate);
    const referenceDateIso = toIsoDate(referenceDate);
    const referenceDateLabel = referenceDate.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
    const detectedDueDateIso = normalizeDueDate(temporalContext.detectedDueDateIso, referenceDate);

    const compactCandidates = candidates.map((entry, index) => {
      const note = entry.note || {};
      return {
        position: index + 1,
        id: note.id,
        similarity: Number(entry.similarity || 0).toFixed(3),
        title: escapeForPrompt(note.title),
        type: note.type,
        priority: note.priority,
        tags: Array.isArray(note.tags) ? note.tags : [],
        preview: escapeForPrompt(String(note.body || "").slice(0, 320))
      };
    });

    return `
Voce e um editor de notas premium em pt-BR com foco em produtividade.
Objetivo: transformar entrada bruta em nota acionavel e organizada em Markdown.

CONTEXTO TEMPORAL:
- Data atual de referencia: ${referenceDateLabel} (${referenceDateIso}).
- Data sugerida por parser local: ${detectedDueDateIso || "nenhuma"}.

REGRAS DE SAIDA:
- Responda APENAS com JSON valido (sem texto fora do JSON).
- operation: "create" ou "update".
- confidence: numero entre 0 e 1.
- targetNoteId: obrigatorio quando operation = "update" (deve estar entre os candidatos).
- title: titulo curto e objetivo (4-10 palavras).
- markdownBody: conteudo EM MARKDOWN, bem estruturado.
- dueDate: string no formato YYYY-MM-DD quando houver prazo implicito/explicito; senao "".
- type: "note" | "task" | "idea" | "reference".
- priority: "low" | "medium" | "high".
- tags: array de strings curtas.

ENGENHARIA DE QUALIDADE NO markdownBody:
- Corrija erros evidentes da entrada sem mudar o sentido.
- Estruture com secoes claras (Contexto, Pontos-chave, Proximos passos).
- Se for tarefa, inclua checklist com "- [ ]".
- Se houver expressao temporal relativa (ex.: "na quarta", "proxima semana"), converta usando a data de referencia e registre no markdown.
- Diferencie evento passado de prazo: termos como "comecei", "retomei", "foi" indicam historico e NAO definem dueDate.
- Se hoje for segunda e o texto disser "comecei na sexta", trate como sexta da semana passada no contexto.
- Se houver "ate sexta"/"prazo sexta", dueDate deve ser a proxima sexta aplicavel conforme data de referencia.
- Se houver candidato com MESMO objetivo/titulo e mesmo prazo, prefira "update" para enriquecer a nota existente (evite duplicatas).
- Inclua Mermaid apenas quando o tema realmente for fluxo/processo/etapas/arquitetura/timeline.
- Nao invente fatos. Se faltar detalhe, mantenha objetivo e pratico.

ENTRADA RAPIDA:
${text}

CANDIDATOS:
${JSON.stringify(compactCandidates, null, 2)}

JSON esperado:
{
  "operation": "create",
  "confidence": 0.0,
  "targetNoteId": "",
  "title": "titulo",
  "markdownBody": "## Titulo\\n\\n### Contexto\\n- ponto\\n\\n### Proximos passos\\n- [ ] acao",
  "dueDate": "",
  "type": "note",
  "priority": "medium",
  "tags": ["tag1", "tag2"]
}
`;
  }

  normalizeClassificationResponse(rawText) {
    const parsed = tryParseJson(rawText);

    const operation = normalizeString(parsed?.operation, "create").toLowerCase() === "update"
      ? "update"
      : "create";

    return {
      operation,
      confidence: normalizeConfidence(parsed?.confidence),
      targetNoteId: normalizeString(parsed?.targetNoteId),
      title: normalizeString(parsed?.title),
      bodyAppend: normalizeString(parsed?.bodyAppend),
      markdownBody: normalizeString(parsed?.markdownBody),
      dueDate: normalizeString(parsed?.dueDate || parsed?.due_date || parsed?.deadline || parsed?.dueAt),
      type: normalizeType(parsed?.type),
      priority: normalizePriority(parsed?.priority),
      tags: normalizeTags(parsed?.tags),
      source: normalizeOptionalSource(parsed?.source)
    };
  }

  async indexNoteSnapshot(note) {
    if (!note || !this.vectorStore?.addDocument) return;

    try {
      const dueDateIso = note.dueAt ? toIsoDate(new Date(note.dueAt)) : "";
      const dueLine = dueDateIso ? `Prazo: ${dueDateIso}` : "";
      const statusLine = note.isCompleted ? "Status: completed" : "Status: pending";
      const noteIdLine = note.id ? `NoteId: ${note.id}` : "";
      const snapshot = [noteIdLine, note.title, statusLine, dueLine, note.body].filter(Boolean).join("\n").trim();
      if (!snapshot) return;
      await this.vectorStore.addDocument(snapshot, {
        type: "note",
        timestamp: Date.now(),
        noteId: note.id
      });
    } catch (error) {
      console.error("NoteService: failed to index note snapshot", error);
    }
  }
}
