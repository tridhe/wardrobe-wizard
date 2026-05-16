import { createFileRoute } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
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

function StylistPage() {
  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/chat" }), []);
  const { messages, sendMessage, status } = useChat({
    transport,
    onError: (err) => toast.error(err.message || "Stylist had a moment. Try again."),
  });

  const isLoading = status === "submitted" || status === "streaming";
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isLoading) textareaRef.current?.focus();
  }, [isLoading]);

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
              <h2 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">Stylist</h2>
              <p className="text-sm text-muted-foreground">
                Tell Atelier about your event — get dressed from your closet.
              </p>
            </div>
          </div>
        </header>

        <Conversation className="flex-1">
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
              <div className="px-2 py-3">
                <Shimmer>Composing your look...</Shimmer>
              </div>
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        <div className="border-t border-border bg-background p-4 md:p-6">
          <div className="max-w-3xl mx-auto">
            <PromptInput
              onSubmit={(message) => {
                if (!message.text.trim()) return;
                sendMessage({ text: message.text });
              }}
            >
              <PromptInputTextarea
                ref={textareaRef}
                autoFocus
                placeholder="A rooftop dinner tonight, slightly chilly..."
              />
              <PromptInputFooter className="justify-end">
                <PromptInputSubmit status={status} disabled={isLoading} size="icon-sm" />
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
      <Message from="user">
        <MessageContent>{displayText}</MessageContent>
      </Message>
    );
  }

  return (
    <Message from="assistant">
      <MessageContent>
        {displayText && <MessageResponse>{displayText}</MessageResponse>}
        {outfitIds && (
          <div className="mt-4">
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

