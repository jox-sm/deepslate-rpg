import { Schema, model, models } from "mongoose";
import { CharacterDataDB, MapDataDB, ItemDataDB } from "@/types/gameForm";

const CharacterSchema = new Schema<CharacterDataDB>({
  id: { type: String, required: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, required: true },
  image: { type: String, default: null },
}, { _id: false }); // No _id for subdocs

const MapSchema = new Schema<MapDataDB>({
  id: { type: String, required: true },
  nameOfPlace: { type: String, required: true, trim: true },
  sizeOfPlace: { type: String, default: "" },
  placesAtMap: { type: String, default: "" },
  image: { type: String, default: null },
}, { _id: false });

const ItemSchema = new Schema<ItemDataDB>({
  id: { type: String, required: true },
  name: { type: String, required: true, trim: true },
  image: { type: String, default: null },
}, { _id: false });

const GameSchema = new Schema({
  id: { type: String, index: true },
  characters: [CharacterSchema],
  maps: [MapSchema],
  items: [ItemSchema],
  status: { type: String, default: "draft" }
}, { timestamps: true });

const Game = models.Game || model("Game", GameSchema);
export default Game;