"use client";

import { MessageCircle, Send, X } from "lucide-react";
import { FormEvent, useState } from "react";
import { askConsultant } from "@/lib/api";
import { INITIAL_ASSISTANT_MESSAGE } from "@/lib/mockCompliance";
import { Lang } from "@/lib/types";

type Message = { role: "user" | "assistant"; content: string };

type Props = {
  lang?: Lang;
};

const copy = {
  ar: {
    title: "مساعد ComplyX",
    placeholder: "اسأل عن نتيجة أو مادة نظامية",
    close: "إغلاق المحادثة",
    send: "إرسال"
  },
  en: {
    title: "ComplyX Assistant",
    placeholder: "Ask about a finding or article",
    close: "Close chat",
    send: "Send"
  }
};

export default function ChatConsultation({ lang = "ar" }: Props) {
  const t = copy[lang];
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([{ role: "assistant", content: INITIAL_ASSISTANT_MESSAGE }]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    const trimmed = query.trim();
    if (!trimmed || loading) return;

    const nextMessages: Message[] = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setQuery("");
    setLoading(true);

    try {
      const response = await askConsultant(trimmed, nextMessages);
      setMessages([...nextMessages, { role: "assistant", content: response.answer }]);
    } catch {
      setMessages([
        ...nextMessages,
        {
          role: "assistant",
          content:
            lang === "ar"
              ? "تعذر إرسال الاستشارة الآن. حاول مرة أخرى بعد لحظات."
              : "I could not send the consultation right now. Try again in a moment."
        }
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button className="cx-chat-fab" onClick={() => setOpen((value) => !value)} type="button" aria-label={t.title}>
        <MessageCircle size={24} strokeWidth={2} />
        <span className="cx-chat-fab-pulse" aria-hidden="true" />
      </button>

      <section className={`cx-chat-drawer${open ? " is-open" : ""}`} aria-label={t.title}>
        <div className="cx-chat-header">
          <div className="cx-chat-header-left">
            <div className="cx-chat-avatar">C</div>
            <span className="cx-chat-title">{t.title}</span>
          </div>
          <button className="cx-chat-close" onClick={() => setOpen(false)} type="button" aria-label={t.close}>
            <X size={14} strokeWidth={2.4} />
          </button>
        </div>

        <div className="cx-chat-messages">
          {messages.map((message, index) => (
            <div className={`cx-msg-row${message.role === "user" ? " is-user" : ""}`} key={`${message.role}-${index}`}>
              <div className="cx-msg-group">
                {message.role === "assistant" && <div className="cx-chat-avatar small">C</div>}
                <div className="cx-msg-bubble" dir={lang === "ar" ? "rtl" : "ltr"}>
                  {message.content}
                </div>
              </div>
            </div>
          ))}
          {loading && (
            <div className="cx-msg-row">
              <div className="cx-msg-group">
                <div className="cx-chat-avatar small">C</div>
                <div className="cx-typing" aria-label="Typing">
                  <span className="cx-typing-dot" />
                  <span className="cx-typing-dot" />
                  <span className="cx-typing-dot" />
                </div>
              </div>
            </div>
          )}
        </div>

        <form className="cx-chat-input-row" onSubmit={submit}>
          <input
            className="cx-chat-input"
            dir={lang === "ar" ? "rtl" : "ltr"}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t.placeholder}
          />
          <button className="cx-chat-send" disabled={loading} type="submit" aria-label={t.send}>
            <Send size={18} strokeWidth={2} />
          </button>
        </form>
      </section>
    </>
  );
}
