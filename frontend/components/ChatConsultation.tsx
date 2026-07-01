"use client";

import { MessageCircle, SendHorizonal, X } from "lucide-react";
import { FormEvent, useState } from "react";
import { askConsultant } from "@/lib/api";

type Message = { role: "user" | "assistant"; content: string };

type Props = {
  lang?: "ar" | "en";
};

export default function ChatConsultation({ lang = "ar" }: Props) {
  const copy = {
    ar: {
      title: "مساعد ComplyX",
      start: "اسأل عن مادة تنظيمية أو ثغرة امتثال وسأجيب مع الإشارة للمراجع.",
      placeholder: "اسأل عن نتيجة أو مادة نظامية...",
      label: "فتح المساعد"
    },
    en: {
      title: "ComplyX Assistant",
      start: "Ask about a regulatory article or compliance gap and I will answer with references.",
      placeholder: "Ask about a finding or article...",
      label: "Open assistant"
    }
  }[lang];
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: copy.start }
  ]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!query.trim()) return;
    const nextMessages: Message[] = [...messages, { role: "user", content: query }];
    setMessages(nextMessages);
    setQuery("");
    setLoading(true);
    try {
      const response = await askConsultant(query, nextMessages);
      setMessages([...nextMessages, { role: "assistant", content: response.answer }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button className={open ? "chat-fab hidden" : "chat-fab"} onClick={() => setOpen((value) => !value)} aria-label={copy.label}>
        <span className="bot-pulse" />
        <MessageCircle size={23} />
      </button>

      <section className={open ? "chat-drawer open" : "chat-drawer"} aria-label={copy.title}>
        <div className="chat-drawer-head">
          <div className="chat-title-group">
            <div className="chat-avatar">
              <MessageCircle size={17} />
            </div>
            <strong>{copy.title}</strong>
          </div>
          <button className="chat-close" onClick={() => setOpen(false)} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="chat-log">
          {messages.map((message, index) => (
            <div className={`message ${message.role}`} key={`${message.role}-${index}`}>
              {message.content}
            </div>
          ))}
          {loading && (
            <div className="typing-bubble">
              <span />
              <span />
              <span />
            </div>
          )}
        </div>

        <form className="chat-form" onSubmit={submit}>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.placeholder} />
          <button className="icon-button primary" disabled={loading} aria-label="إرسال">
            <SendHorizonal size={18} />
          </button>
        </form>
      </section>
    </>
  );
}
