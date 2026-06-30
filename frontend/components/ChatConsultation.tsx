"use client";

import { SendHorizonal } from "lucide-react";
import { FormEvent, useState } from "react";
import { askConsultant } from "@/lib/api";

type Message = { role: "user" | "assistant"; content: string };

export default function ChatConsultation() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "اسأل عن مادة تنظيمية أو ثغرة امتثال وسأجيب مع الإشارة للمراجع." }
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
    <section className="panel chat-panel">
      <div className="section-title">
        <span>استشارة تنظيمية</span>
        <strong>ساما</strong>
      </div>
      <div className="chat-log">
        {messages.map((message, index) => (
          <div className={`message ${message.role}`} key={`${message.role}-${index}`}>
            {message.content}
          </div>
        ))}
      </div>
      <form className="chat-form" onSubmit={submit}>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ما هي حدود رسوم التأخير في التمويل الاستهلاكي؟" />
        <button className="icon-button primary" disabled={loading} aria-label="إرسال">
          <SendHorizonal size={18} />
        </button>
      </form>
    </section>
  );
}

