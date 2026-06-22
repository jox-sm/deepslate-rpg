export interface AiCharacterStats {
  level: number;
  health: number;
  max_health: number;
  mana: number;
  max_mana: number;
  experience: number;
  strength: number;
  dexterity: number;
  intelligence: number;
  [key: string]: unknown;
}

export interface AiInventoryItem {
  id: string;
  name: string;
  quantity: number;
  description?: string;
  type?: string;
  effects?: Record<string, unknown>;
}

export interface AiSkill {
  id: string;
  name: string;
  level: number;
  description?: string;
  cooldown?: number;
}

export interface AiGameState {
  character_stats: AiCharacterStats;
  inventory: AiInventoryItem[];
  skills: AiSkill[];
  grid: unknown[][];
  story: string;
  narrative_context?: string;
  quest_log?: AiQuest[];
  [key: string]: unknown;
}

export interface AiQuest {
  id: string;
  title: string;
  description: string;
  status: "active" | "completed" | "failed";
  objectives: AiQuestObjective[];
}

export interface AiQuestObjective {
  description: string;
  completed: boolean;
}

export interface AiQueueItem {
  uuid: string;
  prompt: string;
  player_level?: number;
  character_stats?: Partial<AiCharacterStats>;
  inventory?: AiInventoryItem[];
  skills?: AiSkill[];
  [key: string]: unknown;
}

export interface AiOutput {
  story?: string;
  game_data?: Record<string, unknown>;
  character_stats?: Partial<AiCharacterStats>;
  narrative_context?: string;
  quest_updates?: AiQuest[];
  combat_result?: AiCombatResult;
  [key: string]: unknown;
}

export interface AiCombatResult {
  outcome: "victory" | "defeat" | "retreat" | "ongoing";
  damage_taken: number;
  damage_dealt: number;
  experience_gained: number;
  loot?: AiInventoryItem[];
}

export interface AiRagChunk {
  text: string;
  metadata?: Record<string, unknown>;
}

export interface AiRagStagingItem {
  uuid: string;
  text: string;
  chunk_count: number;
}

export interface AiStoredChunk {
  text: string;
  metadata: Record<string, unknown> | null;
}

export interface AiLockResult {
  acquired: boolean;
}

export interface AiReleaseResult {
  released: boolean;
}

export interface AiQueuePushResponse {
  ok: boolean;
  uuid: string;
}

export interface AiQueuePopResponse {
  ok: boolean;
  item: AiQueueItem | null;
}

export interface AiQueueLengthResponse {
  length: number;
}

export interface AiDelayedPushResponse {
  ok: boolean;
}

export interface AiDelayedPopResponse {
  count: number;
  items: AiQueueItem[];
}

export interface AiOutputCountResponse {
  count: number;
}

export interface AiOkResponse {
  ok: boolean;
}

export interface AiCounterResponse {
  counter: number;
}

export interface AiDbsizeResponse {
  dbsize: number;
}

export interface AiErrorResponse {
  detail: string;
}

export interface AiHealthResponse {
  status: string;
}
