"use client";
import { useEffect, useState } from "react";
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_STATUSES,
  feedbackApiUrl,
  feedbackRequest,
  type FeedbackItem,
} from "@/lib/feedback";

function Screenshot({
  id,
  index,
  token,
}: {
  id: string;
  index: number;
  token: string;
}) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    let objectUrl = "";
    feedbackRequest(`/admin/feedback/${id}/images/${index}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then((response) => response.blob())
      .then((blob) => {
        if (!controller.signal.aborted) {
          objectUrl = URL.createObjectURL(blob);
          setUrl(objectUrl);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setError("Screenshot non disponibile.");
      });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id, index, token]);
  if (error) return <p role="status">{error}</p>;
  // The authenticated blob never exposes Cloudinary credentials or signed URLs.
  return url ? (
    <a href={url} target="_blank" rel="noreferrer">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={`Screenshot ${index + 1}`} />
    </a>
  ) : (
    <p>Caricamento screenshot…</p>
  );
}
export function FeedbackAdmin() {
  const [token, setToken] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const load = async (offset = 0) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await feedbackRequest(
        `/admin/feedback?offset=${offset}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await response.json();
      setItems((previous) =>
        offset ? [...previous, ...data.items] : data.items
      );
      setHasMore(data.hasMore);
      setAuthenticated(true);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const configured = !!feedbackApiUrl();
  return (
    <div className="narrow feedback-admin">
      {!configured && (
        <p className="note">
          Collega prima il servizio feedback. Le istruzioni sono in
          docs/feedback-setup.md.
        </p>
      )}
      {!authenticated ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void load();
          }}
        >
          <p className="subtext">
            Inserisci il token amministratore configurato nel Worker. Rimane
            solo in memoria fino all’uscita da questa schermata.
          </p>
          <label className="field">
            Token amministratore
            <input
              type="password"
              autoComplete="off"
              value={token}
              required
              onChange={(event) => setToken(event.target.value)}
            />
          </label>
          <button
            className="button primary full"
            disabled={!configured || busy}
          >
            {busy ? "Accesso…" : "Apri feedback"}
          </button>
        </form>
      ) : (
        <>
          <div className="two-buttons">
            <button
              className="button subtle"
              disabled={busy}
              onClick={() => void load()}
            >
              Aggiorna
            </button>
            <button
              className="button subtle"
              disabled={busy}
              onClick={() => {
                setToken("");
                setItems([]);
                setAuthenticated(false);
                setExpanded(null);
              }}
            >
              Esci
            </button>
          </div>
          {!items.length && <p className="note">Nessun feedback ricevuto.</p>}
          {items.map((item) => (
            <article className="card feedback-item" key={item.id}>
              <div className="section-heading">
                <strong>{FEEDBACK_CATEGORIES[item.category]}</strong>
                <time className="subtext">
                  {new Date(item.createdAt).toLocaleString("it-IT")}
                </time>
              </div>
              <p className="feedback-message">{item.message}</p>
              <p className="subtext">
                {item.tester || "Tester anonimo"} · {item.screen} ·{" "}
                {item.appVersion} · {item.id.slice(0, 8)}
              </p>
              <label className="field">
                Stato
                <select
                  value={item.status}
                  disabled={busy}
                  onChange={async (event) => {
                    const status = event.target.value as FeedbackItem["status"];
                    setBusy(true);
                    setError("");
                    try {
                      await feedbackRequest(`/admin/feedback/${item.id}`, {
                        method: "PATCH",
                        headers: {
                          Authorization: `Bearer ${token}`,
                          "Content-Type": "application/json",
                        },
                        body: JSON.stringify({ status }),
                      });
                      setItems((previous) =>
                        previous.map((current) =>
                          current.id === item.id
                            ? { ...current, status }
                            : current
                        )
                      );
                    } catch (error) {
                      setError((error as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {Object.entries(FEEDBACK_STATUSES).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              {item.imageCount > 0 && (
                <button
                  className="text-button"
                  onClick={() =>
                    setExpanded(expanded === item.id ? null : item.id)
                  }
                >
                  {expanded === item.id
                    ? "Nascondi screenshot"
                    : `Mostra screenshot (${item.imageCount})`}
                </button>
              )}
              {expanded === item.id && (
                <div className="feedback-previews">
                  {Array.from({ length: item.imageCount }, (_, index) => (
                    <Screenshot
                      key={index}
                      id={item.id}
                      index={index}
                      token={token}
                    />
                  ))}
                </div>
              )}
            </article>
          ))}
          {hasMore && (
            <button
              className="button subtle full"
              disabled={busy}
              onClick={() => void load(items.length)}
            >
              Carica altri
            </button>
          )}
        </>
      )}
      {error && (
        <p className="note" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
