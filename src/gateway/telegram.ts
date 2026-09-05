/**
 * Minimal Telegram Bot API client — long polling, zero dependencies.
 * Only the surface needed by this bot is implemented.
 */

export interface TgUpdate {
  update_id: number;
  message?: TgMessage;
  callback_query?: TgCallbackQuery;
}

export interface TgMessage {
  message_id: number;
  chat: { id: number; type: string };
  from?: { id: number; first_name?: string; username?: string };
  text?: string;
}

export interface TgCallbackQuery {
  id: string;
  from: { id: number };
  message?: TgMessage;
  data?: string;
}

export interface TgKeyboardButton {
  text: string;
  callback_data: string;
}

export type TgButtonRow = TgKeyboardButton[];

export interface TgSendOptions {
  reply_markup?: { inline_keyboard: TgButtonRow[] };
  parse_mode?: "HTML" | "Markdown";
}

export interface TelegramClient {
  sendMessage(chatId: number, text: string, opts?: TgSendOptions): Promise<boolean>;
  editMessageText(chatId: number, messageId: number, text: string, opts?: TgSendOptions): Promise<boolean>;
  answerCallbackQuery(queryId: string, text?: string): Promise<boolean>;
  poll(): Promise<TgUpdate[]>;
  setWebhook(url?: string): Promise<boolean>;
}

export function createTelegramClient(
  token: string,
  opts: { pollTimeoutSec?: number; fetchImpl?: typeof fetch } = {},
): TelegramClient {
  const base = `https://api.telegram.org/bot${token}`;
  const fetchImpl = opts.fetchImpl ?? fetch;
  const pollTimeoutSec = opts.pollTimeoutSec ?? 50;
  let offset = 0;

  async function call<T>(method: string, body: unknown, timeoutMs = 60_000): Promise<T> {
    const res = await fetchImpl(`${base}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) throw new Error(`telegram ${method} HTTP ${res.status}`);
    const json = (await res.json()) as { ok: boolean; result: T; description?: string };
    if (!json.ok) throw new Error(`telegram ${method}: ${json.description ?? "error"}`);
    return json.result;
  }

  return {
    async sendMessage(chatId, text, opts) {
      try {
        await call(`sendMessage`, {
          chat_id: chatId,
          text,
          parse_mode: opts?.parse_mode,
          reply_markup: opts?.reply_markup,
        });
        return true;
      } catch (err) {
        // 400-level failures (e.g. too-long text) are reported, not thrown
        return false;
      }
    },
    async editMessageText(chatId, messageId, text, opts) {
      try {
        await call(`editMessageText`, {
          chat_id: chatId,
          message_id: messageId,
          text,
          parse_mode: opts?.parse_mode,
          reply_markup: opts?.reply_markup,
        });
        return true;
      } catch {
        return false;
      }
    },
    async answerCallbackQuery(queryId, text) {
      try {
        await call(`answerCallbackQuery`, { callback_query_id: queryId, text });
        return true;
      } catch {
        return false;
      }
    },
    async poll() {
      const body: Record<string, unknown> = {
        timeout: pollTimeoutSec,
        allowed_updates: ["message", "callback_query"],
      };
      if (offset > 0) body.offset = offset;
      let updates: TgUpdate[] = [];
      try {
        updates = await call<TgUpdate[]>(`getUpdates`, body, (pollTimeoutSec + 15) * 1000);
      } catch {
        // transient network errors → return [] and retry on next cycle
        return [];
      }
      if (updates.length) {
        offset = Math.max(offset, ...updates.map((u) => u.update_id + 1));
      }
      return updates;
    },
    async setWebhook(url) {
      await call(`setWebhook`, { url });
      return true;
    },
  };
}
