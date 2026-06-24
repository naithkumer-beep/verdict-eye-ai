// Floating chatbot widget — answers FAQs about CivicLens AI.
import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useServerFn } from "@tanstack/react-start";
import { chatWithBot } from "@/lib/chatbot.functions";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import logo from "@/assets/civiclens-logo.png.asset.json";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

export function ChatbotWidget() {
  const { t, i18n } = useTranslation();
  const chat = useServerFn(chatWithBot);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{ role: "assistant", content: t("chatbot.welcome") }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setSending(true);
    try {
      const res = await chat({
        data: {
          messages: next.filter((m) => m.content),
          language: (i18n.language === "my" ? "my" : "en") as "en" | "my",
        },
      });
      setMessages([...next, { role: "assistant", content: res.content }]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Chat failed";
      toast.error(msg);
      setMessages([...next, { role: "assistant", content: "Sorry, I couldn't answer that." }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform hover:scale-105"
          aria-label="Open chatbot"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}

      {open && (
        <Card className="fixed bottom-5 right-5 z-50 flex h-[520px] w-[360px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden p-0 shadow-2xl">
          <div className="flex items-center justify-between border-b border-border bg-secondary/40 px-3 py-2">
            <div className="flex items-center gap-2">
              <img src={logo.url} alt="" className="h-7 w-7 rounded" />
              <div>
                <div className="text-sm font-semibold">{t("chatbot.title")}</div>
                <div className="font-mono text-[9px] uppercase text-muted-foreground">
                  Powered by AI
                </div>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={
                  m.role === "user"
                    ? "ml-auto max-w-[80%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
                    : "max-w-[85%] rounded-lg bg-muted px-3 py-2 text-sm text-foreground"
                }
              >
                {m.content}
              </div>
            ))}
            {sending && (
              <div className="max-w-[85%] rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                <Loader2 className="inline h-3 w-3 animate-spin" /> …
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-border p-2">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void send();
              }}
              className="flex gap-1.5"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t("chatbot.placeholder")}
                className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                maxLength={1000}
                disabled={sending}
              />
              <Button type="submit" size="icon" disabled={sending || !input.trim()}>
                <Send className="h-3.5 w-3.5" />
              </Button>
            </form>
          </div>
        </Card>
      )}
    </>
  );
}
