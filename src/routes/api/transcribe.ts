import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/transcribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.ELEVENLABS_API_KEY;
        if (!apiKey) {
          return new Response(JSON.stringify({ error: "ELEVENLABS_API_KEY is not configured" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        const incoming = await request.formData();
        const file = incoming.get("file");
        if (!(file instanceof Blob)) {
          return new Response(JSON.stringify({ error: "Missing audio file" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const apiFormData = new FormData();
        apiFormData.append("file", file, "audio.webm");
        apiFormData.append("model_id", "scribe_v2");

        const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
          method: "POST",
          headers: { "xi-api-key": apiKey },
          body: apiFormData,
        });

        if (!res.ok) {
          const errText = await res.text();
          return new Response(
            JSON.stringify({ error: `Transcription failed: ${res.status} ${errText}` }),
            { status: 502, headers: { "Content-Type": "application/json" } }
          );
        }

        const data = (await res.json()) as { text?: string };
        return Response.json({ text: data.text ?? "" });
      },
    },
  },
});
