"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.85;

export function ScanLabelModal({
  productId,
  productLabel,
  onClose,
  onSuccess,
}: {
  productId: string;
  productLabel: string;
  onClose: () => void;
  onSuccess: (bucket: "high" | "medium" | "low") => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // Bumped on every startCamera() call so a call that's still in flight when
  // a newer one starts (React Strict Mode's dev-only double-invoke, or a
  // fast retake) can tell it's stale and back off instead of racing the
  // newer call's video.play().
  const generationRef = useRef(0);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    generationRef.current++;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const startCamera = useCallback(async () => {
    const myGeneration = ++generationRef.current;
    setCameraError(null);

    if (typeof window !== "undefined" && !window.isSecureContext) {
      setCameraError(
        "Camera access needs a secure connection. This works at http://localhost:3000 on this computer, but not over plain HTTP from another device (e.g. a phone on the same network) — that needs HTTPS. You can upload a photo instead."
      );
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("This browser doesn't support camera capture here. You can upload a photo instead.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });

      // A newer call superseded this one while we were waiting on the
      // permission prompt / device open — release what we just got and
      // let the newer call own the video element.
      if (myGeneration !== generationRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (playErr) {
          // Benign when a newer call has since taken over the element —
          // that's exactly what AbortError here means. Only surface it as
          // a real failure if this call is still the current one.
          if (myGeneration === generationRef.current) throw playErr;
        }
      }
    } catch (err) {
      if (myGeneration !== generationRef.current) return;
      console.error("[ScanLabelModal] getUserMedia failed:", err);
      const name = err instanceof DOMException ? err.name : "";
      if (name === "NotAllowedError") {
        setCameraError(
          "Camera permission was denied. Allow camera access for this site in your browser's settings, then try again."
        );
      } else if (name === "NotFoundError") {
        setCameraError("No camera was found on this device. You can upload a photo instead.");
      } else if (name === "NotReadableError") {
        setCameraError("The camera is already in use by another app. Close it and try again.");
      } else {
        setCameraError(
          `Camera unavailable${name ? ` (${name})` : ""} — you can upload a photo instead.`
        );
      }
    }
  }, []);

  useEffect(() => {
    // Started a moment later so the camera's own status updates never run inside this effect.
    const id = setTimeout(startCamera, 0);
    return () => {
      clearTimeout(id);
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  function drawToCanvas(source: CanvasImageSource, width: number, height: number): string | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  }

  function capture() {
    const video = videoRef.current;
    if (!video) return;
    const dataUrl = drawToCanvas(video, video.videoWidth, video.videoHeight);
    if (dataUrl) {
      setCapturedImage(dataUrl);
      stopCamera();
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const dataUrl = drawToCanvas(img, img.width, img.height);
        if (dataUrl) setCapturedImage(dataUrl);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  function retake() {
    setCapturedImage(null);
    setError(null);
    startCamera();
  }

  async function submitPhoto() {
    if (!capturedImage) return;
    setSubmitting(true);
    setError(null);
    const base64 = capturedImage.split(",")[1] ?? "";

    try {
      const res = await fetch(`/api/products/${productId}/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mediaType: "image/jpeg" }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Couldn't read that photo.");
        setSubmitting(false);
        return;
      }

      onSuccess(data.bucket);
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
      setSubmitting(false);
    }
  }

  function handleClose() {
    stopCamera();
    onClose();
  }

  return (
    <div className="modal-scrim" onClick={handleClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="scan-title"
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2 id="scan-title">Photo of the ingredient label</h2>
          <button type="button" onClick={handleClose} aria-label="Close" className="modal-x">
            ×
          </button>
        </div>
        <p className="sub">{productLabel}</p>
        <p className="note">
          This photo is for your own bottle. It is used for your routine only, and it doesn&rsquo;t change what anyone else sees.
        </p>

        <canvas ref={canvasRef} className="hidden" />

        {!capturedImage ? (
          <>
            {cameraError ? (
              <div className="callout c-sun items-center text-center">
                <p className="text-[19px]">{cameraError}</p>
                <label className="btn cursor-pointer">
                  Upload a photo instead
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileUpload} />
                </label>
              </div>
            ) : (
              <>
                <div className="relative aspect-[3/4] overflow-hidden rounded-[22px] bg-black">
                  <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
                </div>
                <button type="button" onClick={capture} className="btn btn-block">
                  Take photo
                </button>
                <label className="link-btn flex cursor-pointer items-center justify-center">
                  Or upload a photo
                  <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                </label>
              </>
            )}
          </>
        ) : (
          <>
            <div className="overflow-hidden rounded-[22px] bg-black">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={capturedImage} alt="Captured ingredient label" className="h-auto w-full" />
            </div>
            {error && (
              <p role="alert" className="callout c-blush font-bold">
                {error}
              </p>
            )}
            <div className="flex flex-col gap-3">
              <button type="button" onClick={submitPhoto} disabled={submitting} className="btn btn-ok btn-block">
                {submitting ? "Reading label…" : "Use this photo"}
              </button>
              <button type="button" onClick={retake} disabled={submitting} className="btn btn-2 btn-block">
                Retake
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
