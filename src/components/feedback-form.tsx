"use client";
import { useEffect, useRef, useState, type ClipboardEvent } from "react";
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_VERSION,
  feedbackApiUrl,
  feedbackRequest,
  prepareScreenshot,
} from "@/lib/feedback";

type Attachment = { id: string; file: File; url: string };
export function FeedbackForm({
  screen,
  onAdmin,
}: {
  screen: string;
  onAdmin: () => void;
}) {
  const [message, setMessage] = useState("");
  const [tester, setTester] = useState("");
  const [category, setCategory] =
    useState<keyof typeof FEEDBACK_CATEGORIES>("problem");
  const [images, setImages] = useState<Attachment[]>([]);
  const [preparing, setPreparing] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const activeImages = useRef<Attachment[]>([]);
  const processing = useRef(false);
  const requestId = useRef<string | null>(null);
  const requestFingerprint = useRef("");
  const submitting = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      activeImages.current.forEach((image) => URL.revokeObjectURL(image.url));
      activeImages.current = [];
    };
  }, []);
  const configured = !!feedbackApiUrl();
  const addImages = async (files: File[]) => {
    if (processing.current || sending) return;
    if (activeImages.current.length + files.length > 3) {
      setError("Puoi allegare al massimo 3 screenshot.");
      return;
    }
    processing.current = true;
    setPreparing(true);
    setError("");
    setSent("");
    try {
      for (const file of files) {
        const prepared = await prepareScreenshot(file);
        if (!mounted.current) break;
        activeImages.current = [
          ...activeImages.current,
          {
            id: crypto.randomUUID(),
            file: prepared,
            url: URL.createObjectURL(prepared),
          },
        ];
        setImages(activeImages.current);
      }
    } catch (error) {
      if (mounted.current) setError((error as Error).message);
    } finally {
      processing.current = false;
      if (mounted.current) setPreparing(false);
    }
  };
  const onPaste = (event: ClipboardEvent) => {
    const files = Array.from(event.clipboardData.items)
      .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter((file): file is File => !!file);
    if (files.length) {
      event.preventDefault();
      void addImages(files);
    }
  };
  return (
    <div className="narrow feedback-form" onPaste={onPaste}>
      <p className="subtext">
        Un problema, un’idea o qualcosa che non torna? Raccontamelo qui.
      </p>
      {!configured && (
        <p className="note" role="status">
          Il servizio feedback non è ancora collegato. Puoi provare testo e
          allegati; l’invio sarà disponibile dopo la configurazione.
        </p>
      )}
      {sent && (
        <p className="note" role="status">
          Feedback inviato! Grazie. Riferimento: {sent.slice(0, 8)}.
        </p>
      )}
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (
            submitting.current ||
            processing.current ||
            !configured ||
            !message.trim()
          )
            return;
          submitting.current = true;
          setSending(true);
          setError("");
          setSent("");
          const fingerprint = JSON.stringify([
            message.trim(),
            tester.trim(),
            category,
            screen,
            images.map((image) => image.id),
          ]);
          if (!requestId.current || requestFingerprint.current !== fingerprint)
            requestId.current = crypto.randomUUID();
          requestFingerprint.current = fingerprint;
          const body = new FormData();
          body.set("id", requestId.current);
          body.set("message", message.trim());
          body.set("tester", tester.trim());
          body.set("category", category);
          body.set("screen", screen);
          body.set("appVersion", FEEDBACK_VERSION);
          body.set("website", "");
          images.forEach((image) => body.append("images", image.file));
          try {
            const response = await feedbackRequest("/feedback", {
              method: "POST",
              body,
            });
            const data = await response.json();
            if (!mounted.current) return;
            setSent(data.id);
            setMessage("");
            requestId.current = null;
            activeImages.current.forEach((image) =>
              URL.revokeObjectURL(image.url)
            );
            activeImages.current = [];
            setImages([]);
          } catch (error) {
            if (mounted.current) setError((error as Error).message);
          } finally {
            submitting.current = false;
            if (mounted.current) setSending(false);
          }
        }}
      >
        <fieldset disabled={sending}>
          <label className="field">
            Tipo di feedback
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as typeof category)}
            >
              {Object.entries(FEEDBACK_CATEGORIES).map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Il tuo nome (facoltativo)
            <input
              value={tester}
              maxLength={80}
              onChange={(e) => setTester(e.target.value)}
              placeholder="Come ti chiami?"
            />
          </label>
          <label className="field">
            Messaggio
            <textarea
              required
              maxLength={4000}
              rows={6}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Cosa è successo? Cosa ti aspettavi? Puoi incollare uno screenshot qui."
            />
          </label>
          <div className="section-heading">
            <h2>Screenshot</h2>
            <span className="subtext">{images.length}/3</span>
          </div>
          <p className="subtext">
            Incolla un’immagine copiata oppure sceglila dal dispositivo.
            Controlla che non contenga informazioni che non vuoi condividere.
          </p>
          <div className="feedback-previews">
            {images.map((image, index) => (
              <figure key={image.id}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.url} alt={`Screenshot allegato ${index + 1}`} />
                <button
                  type="button"
                  className="button subtle small"
                  onClick={() => {
                    URL.revokeObjectURL(image.url);
                    activeImages.current = activeImages.current.filter(
                      (item) => item.id !== image.id
                    );
                    setImages(activeImages.current);
                  }}
                >
                  Rimuovi screenshot {index + 1}
                </button>
              </figure>
            ))}
          </div>
          <input
            ref={input}
            hidden
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            onChange={(e) => {
              void addImages(Array.from(e.target.files ?? []));
              e.target.value = "";
            }}
          />
          <button
            type="button"
            className="button subtle full"
            disabled={preparing || images.length >= 3}
            onClick={() => input.current?.click()}
          >
            {preparing ? "Preparo gli screenshot…" : "Aggiungi screenshot"}
          </button>
          <p className="subtext">
            Gli screenshot vengono ridimensionati. Verranno inviati solo il
            messaggio, gli allegati e i dati tecnici indicati sotto.
          </p>
          <p className="subtext">
            Schermata: {screen} · Versione: {FEEDBACK_VERSION}
          </p>
          {error && (
            <p role="alert" className="note">
              {error}
            </p>
          )}
          <button
            type="submit"
            className="button primary full"
            disabled={!configured || preparing || !message.trim()}
          >
            {sending ? "Invio in corso…" : "Invia feedback"}
          </button>
        </fieldset>
      </form>
      <button className="text-button centered" onClick={onAdmin}>
        Area amministratore
      </button>
    </div>
  );
}
