import { createFileRoute } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
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
import { Sidebar } from "@/components/sidebar";
import { closetItems } from "@/lib/closet";
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
    .map((s) => s.trim().toLowerCase())
    .filter((s) => closetItems.some((c) => c.id === s));
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
      <main className="flex-1 flex flex-col h-screen">
        <header className="px-10 pt-10 pb-6 border-b border-border bg-background">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
              <Sparkles className="size-5" strokeWidth={1.75} />
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-foreground">Stylist</h2>
              <p className="text-sm text-muted-foreground">
                Tell Atelier about your event — get dressed from your closet.
              </p>
            </div>
          </div>
        </header>

        <Conversation className="flex-1">
          <ConversationContent className="max-w-3xl mx-auto w-full px-6 py-8">
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

        <div className="border-t border-border bg-background p-6">
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
        {outfitIds && <OutfitCard ids={outfitIds} eventContext={getLastUserText(message)} />}
      </MessageContent>
    </Message>
  );
}

// Best-effort: look up the prior user prompt for try-on styling context.
// Since we don't have backward refs to messages here, just pass through ids.
function getLastUserText(_m: UIMessage): string | undefined {
  return undefined;
}

function OutfitCard({ ids, eventContext }: { ids: string[]; eventContext?: string }) {
  const items = ids
    .map((id) => closetItems.find((c) => c.id === id))
    .filter((i): i is NonNullable<typeof i> => Boolean(i));

  const [tryonUrl, setTryonUrl] = useState<string | null>(null);
  const [tryonLoading, setTryonLoading] = useState(false);
  const [tryonError, setTryonError] = useState<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    setTryonLoading(true);
    fetch("/api/tryon", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemIds: ids, eventContext }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text());
        return res.json() as Promise<{ imageUrl: string }>;
      })
      .then((data) => setTryonUrl(data.imageUrl))
      .catch((err) => setTryonError(err.message || "Couldn't generate try-on"))
      .finally(() => setTryonLoading(false));
  }, [ids, eventContext]);

  return (
    <div className="mt-4 space-y-4">
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="aspect-[3/4] bg-muted relative">
          {tryonLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <div className="size-10 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
              <Shimmer>Dressing you for the occasion...</Shimmer>
            </div>
          )}
          {tryonError && !tryonLoading && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-destructive p-4 text-center">
              {tryonError}
            </div>
          )}
          {tryonUrl && (
            <img
              src={tryonUrl}
              alt="You styled for the event"
              className="w-full h-full object-cover"
            />
          )}
        </div>
        <div className="p-4">
          <p className="text-[10px] font-semibold tracking-wider uppercase text-muted-foreground mb-3">
            The Look
          </p>
          <div className="grid grid-cols-4 gap-2">
            {items.map((item) => (
              <div key={item.id} className="space-y-1.5">
                <div className="aspect-square rounded-md overflow-hidden bg-muted">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
                <p className="text-[11px] font-medium leading-tight text-foreground truncate">
                  {item.name}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
