import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Camera, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { mockOwnerKey, setMockAvatarUrl, useMockUser } from "@/lib/mock-user";

function compressAvatar(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      const size = 256;
      const side = Math.min(image.width, image.height);
      const sx = Math.max(0, (image.width - side) / 2);
      const sy = Math.max(0, (image.height - side) / 2);
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not process image"));
        return;
      }
      ctx.drawImage(image, sx, sy, side, side, 0, 0, size, size);
      resolve(canvas.toDataURL("image/jpeg", 0.72));
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image"));
    };
    image.src = url;
  });
}

export function AvatarUploader({ src, label }: { src: string; label?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const qc = useQueryClient();
  const mockUser = useMockUser();

  async function handleFile(file: File) {
    setUploading(true);
    try {
      if (mockUser) {
        setMockAvatarUrl(mockOwnerKey(mockUser), await compressAvatar(file));
        toast.success("Demo user photo updated");
        qc.invalidateQueries({ queryKey: ["closet-catalog"] });
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      const avatarKey = userId ? `avatar_url:${userId}` : "avatar_url";
      const ext = file.name.split(".").pop() || "jpg";
      const path = `avatars/${userId ?? "anonymous"}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("wardrobe")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("wardrobe").getPublicUrl(path);

      const { error } = await supabase
        .from("app_settings")
        .upsert({ key: avatarKey, value: pub.publicUrl, updated_at: new Date().toISOString() });
      if (error) throw error;

      toast.success("User photo updated");
      qc.invalidateQueries({ queryKey: ["closet-catalog"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "User photo upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      className={cn(
        "group inline-flex items-center gap-2 overflow-hidden transition-colors",
        label
          ? "rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-accent"
          : "relative size-9 rounded-full",
      )}
      title="Upload user photo"
    >
      <span className="relative size-9 shrink-0 overflow-hidden rounded-full">
        <img src={src} alt="User" className="size-9 rounded-full object-cover" />
        <span className="absolute inset-0 bg-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-background">
          {uploading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Camera className="size-4" strokeWidth={1.75} />
          )}
        </span>
      </span>
      {label && <span>{uploading ? "Uploading..." : label}</span>}
      {!label && (
        <span className="sr-only">{uploading ? "Uploading user photo" : "Upload user photo"}</span>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
    </button>
  );
}
