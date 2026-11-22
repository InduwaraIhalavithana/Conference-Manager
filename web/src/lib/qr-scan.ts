"use client";

import jsQR from "jsqr";

/** Reads QR codes from a playing <video>: the browser's BarcodeDetector where there is one, jsQR otherwise. */
export type QrReader = (video: HTMLVideoElement) => Promise<string | null>;

type Detector = { detect(source: CanvasImageSource): Promise<{ rawValue: string }[]> };
type DetectorClass = new (options: { formats: string[] }) => Detector;

export function makeQrReader(): QrReader {
  const Native = (globalThis as unknown as { BarcodeDetector?: DetectorClass }).BarcodeDetector;
  if (Native) {
    const detector = new Native({ formats: ["qr_code"] });
    return async (video) => (await detector.detect(video).catch(() => []))[0]?.rawValue ?? null;
  }
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  return async (video) => {
    if (!context || !video.videoWidth) return null;
    // A smaller copy is plenty for a QR code and much faster to scan.
    const scale = Math.min(1, 640 / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    return jsQR(image.data, image.width, image.height, { inversionAttempts: "dontInvert" })?.data ?? null;
  };
}

/** The ticket code in a scan or typed text: v3 QR codes hold the code, v2 ones a link ending in it. */
export function ticketCodeFrom(text: string): string {
  const last = text.trim().split(/[/?#]/).filter(Boolean).pop() ?? "";
  return last.replace(/[\s-]/g, "").toUpperCase();
}
