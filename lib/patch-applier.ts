import connectDB from "@/models/games/mongodb/client";
import Game from "@/models/games/mongodb/schema";
import type {
  GamePatch,
  GamePatchOp,
  GamePatchRequest,
  GamePatchResponse,
  GamePatchResult,
  GameArrayKey,
} from "@/types/patches";
import { classifyError } from "@/utilities/errorHandler";

const ARRAY_KEYS: GameArrayKey[] = ["characters", "maps", "items"];

function getArrayKeyFromPath(path: string): GameArrayKey | null {
  const segment = path.split("/")[1];
  if (ARRAY_KEYS.includes(segment as GameArrayKey)) {
    return segment as GameArrayKey;
  }
  return null;
}

function getIdFromPath(path: string): string | null {
  const parts = path.split("/");
  if (parts.length < 3) return null;
  const id = parts[2];
  if (!id || id === "-") return null;
  return id;
}

function getFieldFromPath(path: string): string | null {
  const parts = path.split("/");
  if (parts.length < 4) return null;
  return parts.slice(3).join("/");
}

async function applyAdd(gameId: string, patch: GamePatch): Promise<void> {
  if (!("value" in patch)) {
    throw new Error(`add op requires value: ${patch.path}`);
  }
  const arrayKey = getArrayKeyFromPath(patch.path);
  if (!arrayKey) {
    throw new Error(`add op must target a game array: ${patch.path}`);
  }
  await Game.updateOne(
    { id: gameId },
    { $push: { [arrayKey]: patch.value } }
  );
}

async function applyRemove(gameId: string, patch: GamePatch): Promise<void> {
  const arrayKey = getArrayKeyFromPath(patch.path);
  if (!arrayKey) {
    throw new Error(`remove op must target a game array: ${patch.path}`);
  }
  const id = getIdFromPath(patch.path);
  if (!id) {
    throw new Error(`remove op requires an id: ${patch.path}`);
  }
  await Game.updateOne(
    { id: gameId },
    { $pull: { [arrayKey]: { id } } }
  );
}

async function applyReplace(gameId: string, patch: GamePatch): Promise<void> {
  if (!("value" in patch)) {
    throw new Error(`replace op requires value: ${patch.path}`);
  }
  const arrayKey = getArrayKeyFromPath(patch.path);
  if (!arrayKey) {
    throw new Error(`replace op must target a game array: ${patch.path}`);
  }
  const id = getIdFromPath(patch.path);
  const field = getFieldFromPath(patch.path);
  if (!id || !field) {
    throw new Error(`replace op requires id and field: ${patch.path}`);
  }
  const mongoPath = `${arrayKey}.$[elem].${field}`;
  await Game.updateOne(
    { id: gameId },
    { $set: { [mongoPath]: patch.value } },
    { arrayFilters: [{ "elem.id": id }] }
  );
}

export async function applyGamePatches(request: GamePatchRequest): Promise<GamePatchResponse> {
  const { id: gameId, patches } = request;
  const results: GamePatchResult[] = [];
  let applied = 0;
  const skipped = 0;
  let errors = 0;

  await connectDB();

  for (let i = 0; i < patches.length; i++) {
    const patch = patches[i];
    const op: GamePatchOp = patch.op;
    const path = patch.path;
    try {
      if (op === "add") {
        await applyAdd(gameId, patch);
      } else if (op === "remove") {
        await applyRemove(gameId, patch);
      } else if (op === "replace") {
        await applyReplace(gameId, patch);
      } else {
        throw new Error(`unknown op: ${op as string}`);
      }
      results.push({ index: i, op, path, status: "applied" });
      applied++;
    } catch (error) {
      const classified = classifyError(error, `patch-applier.${op}.${path}`);
      results.push({
        index: i,
        op,
        path,
        status: "error",
        error: classified.message,
      });
      errors++;
    }
  }

  return { gameId, applied, skipped, errors, results };
}
