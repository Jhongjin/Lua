import { ASSET_STORAGE_BUCKET } from "@/config/constants";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

export type ImageDimensions = {
  width: number;
  height: number;
};

export type VideoMetadata = {
  width: number;
  height: number;
  durationSeconds: number;
};

type StoreImageAssetInput = {
  jobId: string;
  bytes: ArrayBuffer;
  contentType: string;
  filename: string;
  promptUsed?: string | null;
  validationNote?: string | null;
};

type StoreVideoAssetInput = {
  jobId: string;
  bytes: ArrayBuffer;
  contentType: string;
  filename: string;
  promptUsed?: string | null;
  validationNote?: string | null;
  metadata?: VideoMetadata | null;
};

type RecordStoredVideoAssetInput = {
  jobId: string;
  storagePath: string;
  publicUrl?: string | null;
  promptUsed?: string | null;
  validationNote?: string | null;
  metadata: VideoMetadata;
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

function getVideoExtension(contentType: string, filename: string) {
  const knownExtension = filename.split(".").pop();

  if (knownExtension && ["mp4", "mov", "m4v"].includes(knownExtension.toLowerCase())) {
    return knownExtension.toLowerCase();
  }

  if (contentType === "video/quicktime") {
    return "mov";
  }

  return "mp4";
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

type Mp4Box = {
  type: string;
  start: number;
  end: number;
  contentStart: number;
};

const MP4_CONTAINER_BOXES = new Set([
  "moov",
  "trak",
  "mdia",
  "minf",
  "stbl",
  "edts",
  "dinf",
  "mvex",
  "moof",
  "traf",
  "meta",
]);

function readUInt64BEAsNumber(buffer: Buffer, offset: number) {
  const value = buffer.readBigUInt64BE(offset);

  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    return null;
  }

  return Number(value);
}

function readFixed16Point16(buffer: Buffer, offset: number) {
  return buffer.readUInt32BE(offset) / 65536;
}

function readSignedFixed16Point16(buffer: Buffer, offset: number) {
  return buffer.readInt32BE(offset) / 65536;
}

function walkMp4Boxes(
  buffer: Buffer,
  start: number,
  end: number,
  visitor: (box: Mp4Box) => void,
  depth = 0,
) {
  if (depth > 10) {
    return;
  }

  let offset = start;

  while (offset + 8 <= end) {
    let size = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    let headerSize = 8;

    if (size === 1) {
      if (offset + 16 > end) {
        return;
      }

      const largeSize = readUInt64BEAsNumber(buffer, offset + 8);

      if (!largeSize) {
        return;
      }

      size = largeSize;
      headerSize = 16;
    } else if (size === 0) {
      size = end - offset;
    }

    if (size < headerSize || offset + size > end) {
      return;
    }

    const box = {
      type,
      start: offset,
      end: offset + size,
      contentStart: offset + headerSize,
    };

    visitor(box);

    if (MP4_CONTAINER_BOXES.has(type)) {
      const nestedStart = type === "meta" ? box.contentStart + 4 : box.contentStart;
      walkMp4Boxes(buffer, nestedStart, box.end, visitor, depth + 1);
    }

    offset += size;
  }
}

function parseMovieDuration(buffer: Buffer, box: Mp4Box) {
  const contentStart = box.contentStart;

  if (contentStart + 20 > box.end) {
    return null;
  }

  const version = buffer[contentStart];

  if (version === 1) {
    if (contentStart + 32 > box.end) {
      return null;
    }

    const timescale = buffer.readUInt32BE(contentStart + 20);
    const duration = readUInt64BEAsNumber(buffer, contentStart + 24);

    return timescale > 0 && duration !== null ? duration / timescale : null;
  }

  if (contentStart + 20 > box.end) {
    return null;
  }

  const timescale = buffer.readUInt32BE(contentStart + 12);
  const duration = buffer.readUInt32BE(contentStart + 16);

  return timescale > 0 ? duration / timescale : null;
}

function parseTrackDimensions(buffer: Buffer, box: Mp4Box) {
  const contentStart = box.contentStart;
  const version = buffer[contentStart];
  const matrixOffset = version === 1 ? contentStart + 52 : contentStart + 40;
  const widthOffset = version === 1 ? contentStart + 88 : contentStart + 76;
  const heightOffset = version === 1 ? contentStart + 92 : contentStart + 80;

  if (heightOffset + 4 > box.end || matrixOffset + 20 > box.end) {
    return null;
  }

  let width = readFixed16Point16(buffer, widthOffset);
  let height = readFixed16Point16(buffer, heightOffset);

  if (width <= 0 || height <= 0) {
    return null;
  }

  const a = readSignedFixed16Point16(buffer, matrixOffset);
  const b = readSignedFixed16Point16(buffer, matrixOffset + 4);
  const c = readSignedFixed16Point16(buffer, matrixOffset + 12);
  const d = readSignedFixed16Point16(buffer, matrixOffset + 16);
  const isRotated =
    Math.abs(a) < 0.01 &&
    Math.abs(d) < 0.01 &&
    Math.abs(b) > 0.9 &&
    Math.abs(c) > 0.9;

  if (isRotated) {
    [width, height] = [height, width];
  }

  return {
    width: Math.round(width),
    height: Math.round(height),
  };
}

export function getMp4VideoMetadata(bytes: ArrayBuffer): VideoMetadata | null {
  const buffer = Buffer.from(bytes);

  if (buffer.length < 16) {
    return null;
  }

  let durationSeconds: number | null = null;
  const dimensionCandidates: Pick<VideoMetadata, "width" | "height">[] = [];

  walkMp4Boxes(buffer, 0, buffer.length, (box) => {
    if (box.type === "mvhd" && durationSeconds === null) {
      durationSeconds = parseMovieDuration(buffer, box);
    }

    if (box.type === "tkhd") {
      const parsed = parseTrackDimensions(buffer, box);

      if (parsed) {
        dimensionCandidates.push(parsed);
      }
    }
  });

  const dimensions = dimensionCandidates.sort(
    (left, right) => right.width * right.height - left.width * left.height,
  )[0];

  if (!durationSeconds || !dimensions) {
    return null;
  }

  return {
    width: dimensions.width,
    height: dimensions.height,
    durationSeconds,
  };
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

export function buildVideoStoragePath(input: {
  jobId: string;
  filename: string;
  contentType: string;
}) {
  const extension = getVideoExtension(input.contentType, input.filename);

  return `jobs/${input.jobId}/videos/${Date.now()}-${crypto.randomUUID()}.${extension}`;
}

export async function createSignedVideoUploadTarget(input: {
  jobId: string;
  filename: string;
  contentType: string;
}) {
  await ensureAssetBucket();

  const storagePath = buildVideoStoragePath(input);
  const supabase = getSupabaseServiceRoleClient();
  const { data, error } = await supabase.storage
    .from(ASSET_STORAGE_BUCKET)
    .createSignedUploadUrl(storagePath, {
      upsert: true,
    });

  if (error) {
    throw new Error(`Failed to create signed video upload URL: ${error.message}`);
  }

  const { data: publicUrl } = supabase.storage
    .from(ASSET_STORAGE_BUCKET)
    .getPublicUrl(storagePath);

  return {
    storagePath,
    signedUrl: data.signedUrl,
    token: data.token,
    publicUrl: publicUrl.publicUrl,
  };
}

export async function recordStoredVideoAsset(
  input: RecordStoredVideoAssetInput,
): Promise<Tables<"assets">> {
  await ensureAssetBucket();

  const supabase = getSupabaseServiceRoleClient();
  const publicUrl =
    input.publicUrl ??
    supabase.storage.from(ASSET_STORAGE_BUCKET).getPublicUrl(input.storagePath).data
      .publicUrl;
  const { data, error } = await supabase
    .from("assets")
    .insert({
      job_id: input.jobId,
      type: "video",
      storage_path: input.storagePath,
      public_url: publicUrl,
      prompt_used: input.promptUsed,
      width: input.metadata.width,
      height: input.metadata.height,
      duration_seconds: input.metadata.durationSeconds,
      validation_passed: false,
      validation_note: input.validationNote,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to record video asset: ${error.message}`);
  }

  return data;
}

export async function storeVideoAsset(
  input: StoreVideoAssetInput,
): Promise<Tables<"assets">> {
  await ensureAssetBucket();

  const contentType = input.contentType || "video/mp4";
  const storagePath = buildVideoStoragePath({
    jobId: input.jobId,
    filename: input.filename,
    contentType,
  });
  const metadata = input.metadata ?? getMp4VideoMetadata(input.bytes);

  if (!metadata) {
    throw new Error(
      "Unable to read video metadata. Only MP4/MOV files with readable duration and dimensions are supported.",
    );
  }

  const supabase = getSupabaseServiceRoleClient();
  const { error: uploadError } = await supabase.storage
    .from(ASSET_STORAGE_BUCKET)
    .upload(storagePath, Buffer.from(input.bytes), {
      contentType,
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`Failed to upload video asset: ${uploadError.message}`);
  }

  return recordStoredVideoAsset({
    jobId: input.jobId,
    storagePath,
    promptUsed: input.promptUsed,
    validationNote: input.validationNote,
    metadata,
  });
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
