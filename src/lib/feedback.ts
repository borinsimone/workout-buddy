export const FEEDBACK_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || "0.1-feedback.1";
export const FEEDBACK_CATEGORIES = {
  problem: "Problema",
  suggestion: "Suggerimento",
  other: "Altro",
};
export const FEEDBACK_STATUSES = {
  new: "Nuovo",
  todo: "Da fare",
  resolved: "Risolto",
};
export type FeedbackItem = {
  id: string;
  createdAt: string;
  category: keyof typeof FEEDBACK_CATEGORIES;
  message: string;
  tester: string;
  screen: string;
  appVersion: string;
  status: keyof typeof FEEDBACK_STATUSES;
  imageCount: number;
};
export function feedbackApiUrl() {
  const configured = process.env.NEXT_PUBLIC_FEEDBACK_API_URL?.trim();
  if (!configured) return "";
  try {
    const url = new URL(configured);
    if (
      url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(url.hostname)
      )
    )
      return "";
    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !["", "/"].includes(url.pathname)
    )
      return "";
    return url.origin;
  } catch {
    return "";
  }
}
export async function feedbackRequest(path: string, options: RequestInit = {}) {
  const base = feedbackApiUrl();
  if (!base) throw new Error("Il servizio feedback non è ancora collegato.");
  let response: Response;
  try {
    response = await fetch(base + path, {
      ...options,
      signal: options.signal ?? AbortSignal.timeout(60000),
    });
  } catch {
    throw new Error(
      "Invio non completato. Controlla la connessione e riprova: il contenuto è ancora qui."
    );
  }
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(
      data?.error ?? `Richiesta non riuscita (${response.status}). Riprova.`
    );
  }
  return response;
}
export async function prepareScreenshot(file: File): Promise<File> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
    throw new Error("Usa uno screenshot PNG, JPEG o WebP.");
  if (file.size > 12 * 1024 * 1024)
    throw new Error(
      "L’immagine supera 12 MB. Scegli uno screenshot più piccolo."
    );
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode().catch(() => {
      throw new Error("Non riesco a leggere questa immagine.");
    });
    const scale = Math.min(
      1,
      1600 / Math.max(image.naturalWidth, image.naturalHeight)
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context)
      throw new Error("Il browser non riesce a preparare l’immagine.");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.85, 0.7, 0.55, 0.4]) {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", quality)
      );
      if (blob && blob.size <= 700 * 1024)
        return new File([blob], "screenshot.jpg", { type: "image/jpeg" });
    }
    throw new Error("L’immagine è ancora troppo grande. Ritagliala e riprova.");
  } finally {
    URL.revokeObjectURL(url);
  }
}
