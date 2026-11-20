// A single chat/story line as rendered by the play screen.
export interface Message {
  role: "user" | "assistant";
  text: string;
}
