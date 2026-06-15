import { ASSET_STORAGE_BUCKET } from "@/config/constants";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

export type ImageDimensions = {
  width: number;
  height: number;
};

type StoreImageAssetInput = {
  jobId: string;
  bytes: ArrayBuffer;
  contentType: string;
  filename: string;
  promptUsed?: string | null;
  validationNote?: string | null;
};

function getExtension(contentType: string, filename: string) {
  const knownExtension = filename.split(".").pop();

  if (knownExtension && knownExtension.length <= 5) {
    return knownExtension.toLowerCase();
  }

  if (contentType === "image/png") {
    return "png";
  }

  if (contentType === "image/webp") {
    return "webp";
  }

  return "jpg";
}

function readUint24LE(buffer: Buffer, offset: number) {
  return buffer[offset] + (buffer[offset + 1] << 8) + (buffer[offset + 2] << 16);
}

export function getImageDimensions(bytes: ArrayBuffer): ImageDimensions | null {
  const buffer = Buffer.from(bytes);

  if (
    buffer.length >= 24 &&
    buffer[0] === 0x89 &&
    buffer.toString("ascii", 1, 4) === "PNG"
  ) {
    return {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20),
    };
  }

  if (buffer.length >= 10 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;

    while (offset < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }

      const marker = buffer[offset + 1];
      const segmentLength = buffer.readUInt16BE(offset + 2);
      const isStartOfFrame =
        (marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf);

      if (isStartOfFrame && offset + 8 < buffer.length) {
        return {
          height: buffer.readUInt16BE(offset + 5),
          width: buffer.readUInt16BE(offset + 7),
        };
      }

      offset += 2 + segmentLength;
    }
  }

  if (
    buffer.length >= 30 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    const chunk = buffer.toString("ascii", 12, 16);

    if (chunk === "VP8X") {
      return {
        width: readUint24LE(buffer, 24) + 1,
        height: readUint24LE(buffer, 27) + 1,
      };
    }
  }

  return null;
}

export async function ensureAssetBucket() {
  const supabase = getSupabaseServiceRoleClient();
  const { error } = await supabase.storage.createBucket(ASSET_STORAGE_BUCKET, {
    public: true,
  });

  if (
    error &&
    !error.message.toLowerCase().includes("already") &&
    !error.message.toLowerCase().includes("exists")
  ) {
    throw new Error(`Failed to ensure asset bucket: ${error.message}`);
  }
}

export async function storeImageAsset(
  input: StoreImageAssetInput,
): Promise<Tables<"assets">> {
  await ensureAssetBucket();

  const contentType = input.contentType || "image/jpeg";
  const extension = getExtension(contentType, input.filename);
  const storagePath = `jobs/${input.jobId}/images/${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const dimensions = getImageDimensions(input.bytes);
  const supabase = getSupabaseServiceRoleClient();
  const { error: uploadError } = await supabase.storage
    .from(ASSET_STORAGE_BUCKET)
    .upload(storagePath, Buffer.from(input.bytes), {
      contentType,
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`Failed to upload image asset: ${uploadError.message}`);
  }

  const { data: publicUrl } = supabase.storage
    .from(ASSET_STORAGE_BUCKET)
    .getPublicUrl(storagePath);

  const { data, error } = await supabase
    .from("assets")
    .insert({
      job_id: input.jobId,
      type: "image",
      storage_path: storagePath,
      public_url: publicUrl.publicUrl,
      prompt_used: input.promptUsed,
      width: dimensions?.width,
      height: dimensions?.height,
      validation_passed: false,
      validation_note: input.validationNote,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to record image asset: ${error.message}`);
  }

  return data;
}

export async function downloadImageBytes(url: string, timeoutMs = 45_000) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`Failed to download generated image: ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "image/jpeg";

  return {
    bytes: await response.arrayBuffer(),
    contentType,
  };
}
