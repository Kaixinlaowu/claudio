import { getPreference, setPreference } from '../db';
import { chatWithAI } from './claude';

// --- Constants ---

const PREF_AGENT_MEMORY = 'agent_memory';
const PREF_USER_PROFILE = 'user_profile';

const AGENT_MEMORY_CHAR_LIMIT = 2200;
const USER_PROFILE_CHAR_LIMIT = 1375;

const SEPARATOR = '§';

// --- Types ---

interface MemoryStore {
  key: string;
  charLimit: number;
  label: string;
}

const STORES: Record<string, MemoryStore> = {
  agent: { key: PREF_AGENT_MEMORY, charLimit: AGENT_MEMORY_CHAR_LIMIT, label: 'AGENT MEMORY' },
  user: { key: PREF_USER_PROFILE, charLimit: USER_PROFILE_CHAR_LIMIT, label: 'USER PROFILE' },
};

// --- Security ---

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /you\s+are\s+now\s+/i,
  /system\s*:\s*/i,
  /\[INST\]/i,
  /<<SYS>>/i,
  /<\|im_start\|>/i,
  /act\s+as\s+/i,
  /forget\s+(everything|all|your)/i,
  /disregard\s+/i,
];

function sanitizeEntry(text: string): string | null {
  const cleaned = text.trim();
  if (cleaned.length < 3 || cleaned.length > 200) return null;
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(cleaned)) return null;
  }
  return cleaned;
}

// --- Storage helpers ---

async function loadEntries(store: MemoryStore): Promise<string[]> {
  const raw = await getPreference(store.key);
  if (!raw) return [];
  return raw.split(SEPARATOR).map(s => s.trim()).filter(Boolean);
}

async function saveEntries(store: MemoryStore, entries: string[]): Promise<void> {
  await setPreference(store.key, entries.join(SEPARATOR));
}

function charCount(entries: string[]): number {
  return entries.join(SEPARATOR).length;
}

// --- Core operations ---

/**
 * Add an entry to a memory store.
 * Handles deduplication, capacity management, and consolidation.
 */
async function addEntry(storeKey: 'agent' | 'user', content: string): Promise<boolean> {
  const store = STORES[storeKey];
  const sanitized = sanitizeEntry(content);
  if (!sanitized) return false;

  const entries = await loadEntries(store);

  // Exact duplicate check
  if (entries.some(e => e === sanitized)) return false;

  // Substring duplicate check — if new entry is a superset of an existing one, replace
  const substringIdx = entries.findIndex(e =>
    sanitized.includes(e) || e.includes(sanitized)
  );
  if (substringIdx !== -1) {
    // Keep the longer one
    entries[substringIdx] = entries[substringIdx].length >= sanitized.length
      ? entries[substringIdx]
      : sanitized;
    await saveEntries(store, entries);
    return true;
  }

  // Check capacity
  const newEntries = [...entries, sanitized];
  const totalChars = charCount(newEntries);

  if (totalChars > store.charLimit) {
    // Try consolidating: merge oldest entries
    const consolidated = await consolidateEntries(store, newEntries);
    await saveEntries(store, consolidated);
  } else {
    await saveEntries(store, newEntries);
  }

  return true;
}

/**
 * Add an entry to agent memory (exported for use by learner.ts).
 */
export async function addAgentMemory(content: string): Promise<boolean> {
  return addEntry('agent', content);
}

/**
 * Add an entry to user profile (exported for external use).
 */
export async function addUserProfile(content: string): Promise<boolean> {
  return addEntry('user', content);
}

/**
 * Consolidate entries when over capacity.
 * Uses AI to merge related entries into shorter versions.
 */
async function consolidateEntries(store: MemoryStore, entries: string[]): Promise<string[]> {
  // Simple strategy: remove oldest entries (last in array) until under limit
  let result = [...entries];
  while (charCount(result) > store.charLimit && result.length > 1) {
    result.pop(); // Remove oldest (last)
  }

  // If still over limit with 1 entry, truncate it
  if (result.length === 1 && charCount(result) > store.charLimit) {
    result[0] = result[0].substring(0, store.charLimit - 10) + '…';
  }

  return result;
}

/**
 * Replace an entry using substring matching.
 */
export async function replaceEntry(storeKey: 'agent' | 'user', oldTextSubstring: string, newContent: string): Promise<boolean> {
  const store = STORES[storeKey];
  const sanitized = sanitizeEntry(newContent);
  if (!sanitized) return false;

  const entries = await loadEntries(store);
  const idx = entries.findIndex(e => e.includes(oldTextSubstring));

  if (idx === -1) return false;

  entries[idx] = sanitized;
  await saveEntries(store, entries);
  return true;
}

/**
 * Remove an entry using substring matching.
 */
export async function removeEntry(storeKey: 'agent' | 'user', oldTextSubstring: string): Promise<boolean> {
  const store = STORES[storeKey];
  const entries = await loadEntries(store);
  const idx = entries.findIndex(e => e.includes(oldTextSubstring));

  if (idx === -1) return false;

  entries.splice(idx, 1);
  await saveEntries(store, entries);
  return true;
}

// --- Context injection ---

/**
 * Format a memory store for system prompt injection.
 * Returns Hermes-style block with capacity header.
 */
async function formatStoreForContext(storeKey: 'agent' | 'user'): Promise<string> {
  const store = STORES[storeKey];
  const entries = await loadEntries(store);

  if (entries.length === 0) {
    return `══════════════════${store.label} [0% — 0/${store.charLimit} chars]══════════════════\n(empty)`;
  }

  const content = entries.join(SEPARATOR);
  const usage = Math.round((content.length / store.charLimit) * 100);

  return `══════════════════${store.label} [${usage}% — ${content.length}/${store.charLimit} chars]══════════════════\n${content}`;
}

/**
 * Get full memory context for injection into system prompt.
 */
export async function getMemoryContext(): Promise<string> {
  const [userCtx, agentCtx] = await Promise.all([
    formatStoreForContext('user'),
    formatStoreForContext('agent'),
  ]);
  return `${userCtx}\n\n${agentCtx}`;
}

// --- Extraction ---

/**
 * Extract memories from a conversation using AI.
 * Runs silently in the background.
 */
export async function extractMemories(
  userMessage: string,
  aiReply: string,
): Promise<void> {
  try {
    const prompt = `分析以下对话，提取需要记住的信息。

用户: ${userMessage}
AI: ${aiReply}

返回 JSON 对象：
{
  "user_profile": ["用户偏好/习惯/不喜欢的条目"],
  "agent_memory": ["环境/惯例/事实条目"]
}

规则：
- 只提取明确表达的信息，不猜测
- 每条尽量简短（<50字）
- 没有值得记忆的返回空数组
- 只返回 JSON`;

    const response = await chatWithAI([{ role: 'user', content: prompt }]);
    const extracted = parseExtractionResponse(response.say);

    // Add to user_profile
    for (const entry of extracted.user_profile) {
      await addEntry('user', entry);
    }

    // Add to agent_memory
    for (const entry of extracted.agent_memory) {
      await addEntry('agent', entry);
    }

    if (extracted.user_profile.length + extracted.agent_memory.length > 0) {
      console.log(`[memory] Extracted: ${extracted.user_profile.length} user, ${extracted.agent_memory.length} agent`);
    }
  } catch (err) {
    console.warn('[memory] extractMemories failed:', err);
  }
}

function parseExtractionResponse(text: string): { user_profile: string[]; agent_memory: string[] } {
  const empty = { user_profile: [], agent_memory: [] };
  try {
    const stripped = text
      .replace(/^```(?:json)?\s*\n?/, '')
      .replace(/\n?```\s*$/, '')
      .trim();

    const braceStart = stripped.indexOf('{');
    const braceEnd = stripped.lastIndexOf('}');
    if (braceStart === -1 || braceEnd === -1) return empty;

    const parsed = JSON.parse(stripped.substring(braceStart, braceEnd + 1));

    return {
      user_profile: Array.isArray(parsed.user_profile)
        ? parsed.user_profile.filter((s: any) => typeof s === 'string' && s.trim().length >= 3).map((s: string) => s.trim())
        : [],
      agent_memory: Array.isArray(parsed.agent_memory)
        ? parsed.agent_memory.filter((s: any) => typeof s === 'string' && s.trim().length >= 3).map((s: string) => s.trim())
        : [],
    };
  } catch {
    return empty;
  }
}
