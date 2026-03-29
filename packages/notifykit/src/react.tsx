"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { Herald, Notification, SendResult, NotifyOptions } from "./core/types.js";

interface HeraldContextValue {
  herald: Herald;
}

const HeraldContext = createContext<HeraldContextValue | null>(null);

/** Provide a Herald instance to the component tree. */
export function HeraldProvider({
  herald,
  children,
}: {
  herald: Herald;
  children: ReactNode;
}) {
  return (
    <HeraldContext.Provider value={{ herald }}>
      {children}
    </HeraldContext.Provider>
  );
}

/** Access the Herald instance with sending helpers. */
export function useHerald() {
  const ctx = useContext(HeraldContext);
  if (!ctx) {
    throw new Error("useHerald must be used within a <HeraldProvider>");
  }

  const [isSending, setIsSending] = useState(false);

  const send = useCallback(
    async (notification: Notification): Promise<SendResult> => {
      setIsSending(true);
      try {
        return await ctx.herald.send(notification);
      } finally {
        setIsSending(false);
      }
    },
    [ctx.herald],
  );

  const notify = useCallback(
    async (
      templateName: string,
      options: NotifyOptions,
    ): Promise<SendResult> => {
      setIsSending(true);
      try {
        return await ctx.herald.notify(templateName, options);
      } finally {
        setIsSending(false);
      }
    },
    [ctx.herald],
  );

  return { send, notify, isSending };
}

/** Hook for sending a single notification with status tracking. */
export function useNotification() {
  const ctx = useContext(HeraldContext);
  if (!ctx) {
    throw new Error("useNotification must be used within a <HeraldProvider>");
  }

  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | undefined>();

  const send = useCallback(
    async (notification: Notification): Promise<SendResult> => {
      setStatus("sending");
      setError(undefined);
      try {
        const result = await ctx.herald.send(notification);
        if (result.success) {
          setStatus("sent");
        } else {
          setStatus("error");
          setError(result.error);
        }
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setStatus("error");
        setError(msg);
        return {
          success: false,
          channel: notification.channel,
          error: msg,
        };
      }
    },
    [ctx.herald],
  );

  return { send, status, error };
}
