export type ChatRole = "user" | "assistant" | "system";

export type ChatConnectionState =
  "disconnected" | "connecting" | "connected" | "streaming" | "error";

export interface ChatMessage {
  readonly id: string;
  readonly role: ChatRole;
  readonly content: string;
  readonly createdAt: number;
  readonly streaming?: boolean;
  readonly error?: boolean;
}

export interface ChatSessionState {
  readonly messages: readonly ChatMessage[];
  readonly connection: ChatConnectionState;
  readonly inputDisabled: boolean;
  readonly sendDisabled: boolean;
  readonly showReconnectBanner: boolean;
  readonly emptyState: boolean;
}
