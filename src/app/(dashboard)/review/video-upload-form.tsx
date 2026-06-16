"use client";

import type { FormEvent } from "react";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createManualVideoUploadTargetForJob,
  finalizeManualVideoUploadForJob,
} from "@/app/(dashboard)/review/actions";

type VideoUploadFormProps = {
  jobId: string;
};

type UploadState =
  | "idle"
  | "reading"
  | "preparing"
  | "uploading"
  | "finalizing"
  | "done"
  | "error";

type BrowserVideoMetadata = {
  width: number;
  height: number;
  durationSeconds: number;
};

function getBrowserVideoMetadata(file: File) {
  return new Promise<BrowserVideoMetadata>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");

    video.preload = "metadata";
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);

      if (
        !Number.isFinite(video.duration) ||
        video.duration <= 0 ||
        !video.videoWidth ||
        !video.videoHeight
      ) {
        reject(new Error("영상 메타데이터를 읽을 수 없습니다."));
        return;
      }

      resolve({
        width: video.videoWidth,
        height: video.videoHeight,
        durationSeconds: video.duration,
      });
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("mp4 파일을 브라우저에서 열 수 없습니다."));
    };
    video.src = url;
  });
}

function uploadToSignedUrl(input: {
  signedUrl: string;
  file: File;
  onProgress: (progress: number) => void;
}) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const body = new FormData();

    body.append("cacheControl", "3600");
    body.append("", input.file);
    xhr.open("PUT", input.signedUrl);
    xhr.setRequestHeader("x-upsert", "true");

    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (anonKey) {
      xhr.setRequestHeader("apikey", anonKey);
      xhr.setRequestHeader("authorization", `Bearer ${anonKey}`);
    }

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        input.onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        input.onProgress(100);
        resolve();
        return;
      }

      reject(
        new Error(
          `Supabase Storage upload failed (${xhr.status}): ${xhr.responseText}`,
        ),
      );
    };
    xhr.onerror = () => {
      reject(new Error("Supabase Storage upload request failed."));
    };
    xhr.send(body);
  });
}

export function VideoUploadForm({ jobId }: VideoUploadFormProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<UploadState>("idle");
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState<string | null>(null);

  const isBusy = ["reading", "preparing", "uploading", "finalizing"].includes(
    state,
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const file = inputRef.current?.files?.[0];

    if (!file) {
      setState("error");
      setMessage("업로드할 mp4 파일을 선택해 주세요.");
      return;
    }

    try {
      setState("reading");
      setProgress(0);
      setMessage(null);

      const metadata = await getBrowserVideoMetadata(file);

      setState("preparing");
      const target = await createManualVideoUploadTargetForJob({
        jobId,
        filename: file.name,
        contentType: file.type || "video/mp4",
        sizeBytes: file.size,
      });

      setState("uploading");
      await uploadToSignedUrl({
        signedUrl: target.signedUrl,
        file,
        onProgress: setProgress,
      });

      setState("finalizing");
      await finalizeManualVideoUploadForJob({
        jobId,
        storagePath: target.storagePath,
        publicUrl: target.publicUrl,
        filename: file.name,
        contentType: file.type || "video/mp4",
        width: metadata.width,
        height: metadata.height,
        durationSeconds: metadata.durationSeconds,
        sizeBytes: file.size,
      });

      setState("done");
      setMessage("업로드 완료");
      router.refresh();
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <form className="mt-3 max-w-xl space-y-2" onSubmit={handleSubmit}>
      <div className="flex flex-wrap items-center gap-2">
        <input
          accept="video/mp4,.mp4"
          className="max-w-xs rounded-md border border-border bg-background px-3 py-2 text-sm"
          disabled={isBusy}
          ref={inputRef}
          type="file"
        />
        <button
          className="h-9 rounded-md bg-accent px-3 text-sm font-semibold text-accent-foreground transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isBusy}
          type="submit"
        >
          영상 업로드
        </button>
      </div>
      {state !== "idle" ? (
        <div className="space-y-1">
          <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
            <div
              className="h-full bg-accent transition-all"
              style={{ width: `${state === "uploading" || state === "done" ? progress : 8}%` }}
            />
          </div>
          <div className="font-mono text-xs text-muted">
            {state === "uploading" ? `${progress}%` : state}
            {message ? ` - ${message}` : ""}
          </div>
        </div>
      ) : null}
    </form>
  );
}
