import { createFileRoute } from "@tanstack/react-router";
import "@tanstack/react-start";
import { z } from "zod";

const imageRef = z
  .string()
  .min(1)
  .refine(
    (s) => s.startsWith("data:image/") || /^https?:\/\//.test(s) || s.startsWith("/"),
    "Must be a data URL, absolute URL, or root-relative path",
  );

const BodySchema = z.object({
  items: z
    .array(
      z.object({
        name: z.string().min(1).max(200),
        detail: z.string().max(200).default(""),
        imageUrl: imageRef,
      }),
    )
    .min(1)
    .max(6),
  avatarUrl: imageRef,
  eventContext: z.string().max(500).optional(),
});

function dataUrlToBlob(dataUrl: string): { blob: Blob; extension: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.*)$/);
  if (!match) {
    throw new Error("OpenAI image edits require data URL image inputs");
  }
  const mimeType = match[1];
  const base64 = match[2];
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const extension = mimeType.split("/")[1]?.replace("jpeg", "jpg") || "png";
  return { blob: new Blob([bytes], { type: mimeType }), extension };
}

export const Route = createFileRoute("/api/tryon")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const body = BodySchema.parse(await request.json());
        const key = process.env.OPENAI_API_KEY;
        if (!key) return new Response("Missing OPENAI_API_KEY", { status: 500 });

        // Cap outfit pieces to keep token budget under the model's 32k limit.
        const items = body.items.slice(0, 4);

        const itemList = items
          .map((i) => `${i.name}${i.detail ? ` (${i.detail})` : ""}`)
          .join(", ");
        const prompt = `Editorial full-body fashion photograph of the woman in the first reference photo, wearing this complete outfit composed from the following reference garments: ${itemList}. Faithfully preserve her face, hair, and identity from the first image. Studio lighting on a soft neutral gradient backdrop, high fashion magazine style, sharp focus, elegant pose. ${body.eventContext ? `Styled for: ${body.eventContext}.` : ""}`;

        const formData = new FormData();
        formData.append("model", process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-1");
        formData.append("prompt", prompt);
        formData.append("size", "1024x1536");

        const imageInputs = [
          { label: "avatar", dataUrl: body.avatarUrl },
          ...items.map((item) => ({ label: item.name, dataUrl: item.imageUrl })),
        ];
        imageInputs.forEach((image, index) => {
          const { blob, extension } = dataUrlToBlob(image.dataUrl);
          formData.append("image[]", blob, `${index}-${image.label}.${extension}`);
        });

        const aiRes = await fetch("https://api.openai.com/v1/images/edits", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
          },
          body: formData,
        });

        if (!aiRes.ok) {
          const errText = await aiRes.text();
          return new Response(`AI gateway error: ${errText}`, { status: aiRes.status });
        }

        const data = (await aiRes.json()) as {
          data?: Array<{ b64_json?: string; url?: string }>;
        };
        const generated = data.data?.[0];
        const imageUrl = generated?.b64_json
          ? `data:image/png;base64,${generated.b64_json}`
          : generated?.url;
        if (!imageUrl) {
          return new Response("No image returned", { status: 502 });
        }

        return Response.json({ imageUrl });
      },
    },
  },
});
