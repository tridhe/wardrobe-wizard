import { createFileRoute } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Mic, Square, Loader2 } from "lucide-react";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
  ConversationEmptyState,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { OutfitCard } from "@/components/outfit-card";
import { Sidebar } from "@/components/sidebar";

import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/stylist")({
  head: () => ({
    meta: [
      { title: "Stylist — Atelier AI" },
      { name: "description", content: "Chat with your AI stylist and see yourself in the outfit." },
    ],
  }),
  component: StylistPage,
});

const OUTFIT_RE = /OUTFIT:\s*([a-zA-Z0-9_,\s-]+)/;

declare global {
  interface Window {
    __WARDROBE_AGENT__?: {
      getState: () => {
        route: "stylist";
        status: string;
        isLoading: boolean;
        inputValue: string;
        messageCount: number;
        hasAssistantResult: boolean;
        latestAssistantText: string;
        latestOutfitIds: string[] | null;
      };
      setOccasion: (text: string) => boolean;
      submit: () => boolean;
      scrollConversation: (direction?: "up" | "down" | "top" | "bottom") => boolean;
    };
  }
}

function extractOutfit(text: string): string[] | null {
  const m = text.match(OUTFIT_RE);
  if (!m) return null;
  const ids = m[1]
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return ids.length ? ids : null;
}

function stripOutfitLine(text: string): string {
  return text.replace(OUTFIT_RE, "").trim();
}

function getMessageText(m: UIMessage): string {
  return m.parts
    .map((p) => (p.type === "text" ? p.text : ""))
    .join("")
    .trim();
}

function setTextareaValue(el: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    "value",
  )?.set;
  if (setter) {
    setter.call(el, value);
  } else {
    el.value = value;
  }
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  el.focus();
}

function StylistPage() {
  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/chat" }), []);
  const { messages, sendMessage, status } = useChat({
    transport,
    onError: (err) => toast.error(err.message || "Stylist had a moment. Try again."),
  });

  const isLoading = status === "submitted" || status === "streaming";
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (!isLoading) textareaRef.current?.focus();
  }, [isLoading]);

  const setOccasionText = useCallback((text: string) => {
    const el = textareaRef.current;
    if (!el) return false;
    setTextareaValue(el, text);
    return true;
  }, []);

  const submitPrompt = useCallback(() => {
    const el = textareaRef.current;
    if (!el || !el.value.trim() || isLoading) return false;
    const form =
      el.form ?? document.querySelector<HTMLFormElement>('[data-agent-id="stylist-form"]');
    if (!form) return false;
    form.requestSubmit();
    return true;
  }, [isLoading]);

  const scrollConversation = useCallback((direction: "up" | "down" | "top" | "bottom" = "down") => {
    const root = document.querySelector<HTMLElement>('[data-agent-id="stylist-conversation"]');
    if (!root) return false;
    const candidates = [root, ...Array.from(root.querySelectorAll<HTMLElement>("*"))];
    const target = candidates.find((node) => node.scrollHeight > node.clientHeight + 12) ?? root;
    const amount = Math.max(240, Math.round(target.clientHeight * 0.82));
    if (direction === "top") {
      target.scrollTo({ top: 0, behavior: "smooth" });
    } else if (direction === "bottom") {
      target.scrollTo({ top: target.scrollHeight, behavior: "smooth" });
    } else {
      target.scrollBy({ top: direction === "up" ? -amount : amount, behavior: "smooth" });
    }
    return true;
  }, []);

  useEffect(() => {
    const latestAssistant = [...messages].reverse().find((m) => m.role === "assistant");
    const latestAssistantText = latestAssistant ? getMessageText(latestAssistant) : "";
    const latestOutfitIds = latestAssistantText ? extractOutfit(latestAssistantText) : null;
    const bridge = {
      getState: () => ({
        route: "stylist" as const,
        status,
        isLoading,
        inputValue: textareaRef.current?.value ?? "",
        messageCount: messages.length,
        hasAssistantResult: Boolean(latestAssistantText),
        latestAssistantText,
        latestOutfitIds,
      }),
      setOccasion: setOccasionText,
      submit: submitPrompt,
      scrollConversation,
    };
    window.__WARDROBE_AGENT__ = bridge;
    return () => {
      if (window.__WARDROBE_AGENT__ === bridge) {
        delete window.__WARDROBE_AGENT__;
      }
    };
  }, [isLoading, messages, scrollConversation, setOccasionText, status, submitPrompt]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        setIsTranscribing(true);
        try {
          const fd = new FormData();
          fd.append("file", blob, "audio.webm");
          const res = await fetch("/api/transcribe", { method: "POST", body: fd });
          if (!res.ok) throw new Error((await res.json()).error || "Transcription failed");
          const { text } = (await res.json()) as { text: string };
          if (text && textareaRef.current) {
            const el = textareaRef.current;
            const current = el.value;
            const next = current ? `${current} ${text}` : text;
            setTextareaValue(el, next);
          } else if (!text) {
            toast.error("Didn't catch that — try again.");
          }
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Transcription failed");
        } finally {
          setIsTranscribing(false);
        }
      };
      recorderRef.current = mr;
      mr.start();
      setIsRecording(true);
    } catch {
      toast.error("Microphone access denied.");
    }
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setIsRecording(false);
  };

  return (
    <div className="min-h-screen bg-muted/40 flex">
      <Sidebar />
      <main className="flex-1 flex flex-col h-screen min-w-0 pb-16 md:pb-0">
        <header className="px-4 pt-6 pb-4 md:px-10 md:pt-10 md:pb-6 border-b border-border bg-background">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
              <Sparkles className="size-5" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
                Stylist
              </h2>
              <p className="text-sm text-muted-foreground">
                Tell Atelier about your event — get dressed from your closet.
              </p>
            </div>
          </div>
        </header>

        <Conversation className="flex-1" data-agent-id="stylist-conversation">
          <ConversationContent className="max-w-3xl mx-auto w-full px-4 md:px-6 py-6 md:py-8">
            {messages.length === 0 ? (
              <ConversationEmptyState
                icon={<Sparkles className="size-6" strokeWidth={1.5} />}
                title="Where are you going?"
                description="Describe the event — a gallery opening, weekend brunch, first date — and I'll style you head to toe."
              />
            ) : (
              messages.map((m) => <StylistMessage key={m.id} message={m} />)
            )}
            {status === "submitted" && (
              <div className="px-2 py-3" data-agent-id="stylist-loading">
                <Shimmer>Composing your look...</Shimmer>
              </div>
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        <div className="border-t border-border bg-background p-4 md:p-6">
          <div className="max-w-3xl mx-auto">
            <PromptInput
              data-agent-id="stylist-form"
              onSubmit={(message) => {
                if (!message.text.trim()) return;
                sendMessage({ text: message.text });
              }}
            >
              <PromptInputTextarea
                ref={textareaRef}
                aria-label="Styling occasion"
                data-agent-id="stylist-occasion-input"
                autoFocus
                placeholder="A rooftop dinner tonight, slightly chilly..."
              />
              <PromptInputFooter className="justify-between">
                <Button
                  type="button"
                  variant={isRecording ? "destructive" : "ghost"}
                  size="icon"
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isTranscribing || isLoading}
                  aria-label={isRecording ? "Stop recording" : "Record voice"}
                >
                  {isTranscribing ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : isRecording ? (
                    <Square className="size-4" />
                  ) : (
                    <Mic className="size-4" />
                  )}
                </Button>
                <PromptInputSubmit
                  status={status}
                  disabled={isLoading}
                  size="icon-sm"
                  data-agent-id="stylist-submit"
                />
              </PromptInputFooter>
            </PromptInput>
          </div>
        </div>
      </main>
    </div>
  );
}

function StylistMessage({ message }: { message: UIMessage }) {
  const fullText = getMessageText(message);
  const outfitIds = message.role === "assistant" ? extractOutfit(fullText) : null;
  const displayText = outfitIds ? stripOutfitLine(fullText) : fullText;

  if (message.role === "user") {
    return (
      <Message from="user" data-agent-role="user-message">
        <MessageContent>{displayText}</MessageContent>
      </Message>
    );
  }

  return (
    <Message from="assistant" data-agent-role="assistant-message">
      <MessageContent data-agent-id="stylist-result">
        {displayText && <MessageResponse>{displayText}</MessageResponse>}
        {outfitIds && (
          <div className="mt-4" data-agent-id="stylist-outfit-card">
            <OutfitCard ids={outfitIds} eventContext={getLastUserText(message)} />
          </div>
        )}
      </MessageContent>
    </Message>
  );
}

// Best-effort: look up the prior user prompt for try-on styling context.
function getLastUserText(_m: UIMessage): string | undefined {
  return undefined;
}
