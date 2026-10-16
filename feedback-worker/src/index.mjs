const MAX_BODY = 3 * 1024 * 1024;
const MAX_IMAGE = 768 * 1024;
const CATEGORIES = ["problem", "suggestion", "other"];
const STATUSES = ["new", "todo", "resolved"];
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
async function digest(text, algorithm = "SHA-1") {
  return new Uint8Array(
    await crypto.subtle.digest(algorithm, new TextEncoder().encode(text))
  );
}
export async function cloudinarySignature(params, secret) {
  const data = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  return Array.from(await digest(data + secret), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}
async function admin(request, env) {
  const received = request.headers.get("Authorization") ?? "";
  if (!env.FEEDBACK_ADMIN_TOKEN || env.FEEDBACK_ADMIN_TOKEN.length < 32)
    throw new HttpError(503, "Configura il token amministratore.");
  if (!received.startsWith("Bearer ") || received.length > 512)
    throw new HttpError(401, "Accesso amministratore non valido.");
  const a = await digest(received.slice(7), "SHA-256");
  const b = await digest(env.FEEDBACK_ADMIN_TOKEN, "SHA-256");
  let different = 0;
  for (let i = 0; i < a.length; i++) different |= a[i] ^ b[i];
  if (different) throw new HttpError(401, "Accesso amministratore non valido.");
}
async function limitedBody(request) {
  if (Number(request.headers.get("Content-Length")) > MAX_BODY)
    throw new HttpError(413, "Allegati troppo grandi.");
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "Invio vuoto.");
  const chunks = [];
  let bytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > MAX_BODY) {
      await reader.cancel();
      throw new HttpError(413, "Allegati troppo grandi.");
    }
    chunks.push(value);
  }
  return new Blob(chunks);
}
function text(form, name, max, required = false) {
  const value = form.get(name);
  if (
    typeof value !== "string" ||
    value.length > max ||
    (required && !value.trim())
  )
    throw new HttpError(400, `Campo ${name} non valido.`);
  return value.trim();
}
async function rateLimit(request, env) {
  const now = Math.floor(Date.now() / 1000);
  const ip = request.headers.get("CF-Connecting-IP") ?? "local";
  const hash = Array.from(
    await digest(ip + env.CLOUDINARY_API_SECRET, "SHA-256"),
    (b) => b.toString(16).padStart(2, "0")
  ).join("");
  const buckets = [
    [`ip:${hash}:${Math.floor(now / 3600)}`, 5, 3600],
    [`day:${Math.floor(now / 86400)}`, 20, 86400],
  ];
  for (const [bucket, limit, ttl] of buckets) {
    const allowed = await env.DB.prepare(
      "INSERT INTO feedback_limits (bucket,count,expires_at) VALUES (?,1,?) ON CONFLICT(bucket) DO UPDATE SET count=count+1 WHERE count < ? RETURNING count"
    )
      .bind(bucket, now + ttl, limit)
      .first();
    if (!allowed)
      throw new HttpError(429, "Limite di invii raggiunto. Riprova più tardi.");
  }
  await env.DB.prepare("DELETE FROM feedback_limits WHERE expires_at < ?")
    .bind(now)
    .run();
}
async function cloudinaryCall(env, operation, params, file, fetcher) {
  const signed = {
    ...params,
    timestamp: String(Math.floor(Date.now() / 1000)),
  };
  const body = new FormData();
  for (const [key, value] of Object.entries(signed)) body.set(key, value);
  body.set("api_key", env.CLOUDINARY_API_KEY);
  body.set(
    "signature",
    await cloudinarySignature(signed, env.CLOUDINARY_API_SECRET)
  );
  if (file) body.set("file", file, "screenshot");
  const response = await fetcher(
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(
      env.CLOUDINARY_CLOUD_NAME
    )}/image/${operation}`,
    { method: "POST", body, signal: AbortSignal.timeout(20000) }
  );
  if (!response.ok)
    throw new HttpError(502, "Servizio immagini non disponibile. Riprova.");
  return response.json();
}
async function submit(request, env, fetcher) {
  if (
    !env.CLOUDINARY_CLOUD_NAME ||
    !env.CLOUDINARY_API_KEY ||
    !env.CLOUDINARY_API_SECRET
  )
    throw new HttpError(503, "Il servizio feedback non è ancora configurato.");
  const contentType = request.headers.get("Content-Type") ?? "";
  if (!contentType.startsWith("multipart/form-data;"))
    throw new HttpError(415, "Formato non supportato.");
  let form;
  try {
    form = await new Response(await limitedBody(request), {
      headers: { "Content-Type": contentType },
    }).formData();
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "Invio non valido.");
  }
  const id = text(form, "id", 36, true);
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id))
    throw new HttpError(400, "Identificativo non valido.");
  const category = text(form, "category", 20, true);
  const message = text(form, "message", 4000, true);
  const tester = text(form, "tester", 80);
  const screen = text(form, "screen", 80, true);
  const version = text(form, "appVersion", 80, true);
  if (!CATEGORIES.includes(category))
    throw new HttpError(400, "Categoria non valida.");
  if (form.get("website")) throw new HttpError(400, "Invio non valido.");
  const files = form.getAll("images");
  if (files.length > 3) throw new HttpError(400, "Massimo 3 screenshot.");
  for (const file of files) {
    if (typeof file === "string" || file.size > MAX_IMAGE || file.size === 0)
      throw new HttpError(400, "Screenshot non valido o troppo grande.");
    const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    const png =
      bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71;
    const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    const webp =
      String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
    if (
      !(
        (file.type === "image/png" && png) ||
        (file.type === "image/jpeg" && jpeg) ||
        (file.type === "image/webp" && webp)
      )
    )
      throw new HttpError(400, "Sono supportate immagini PNG, JPEG e WebP.");
  }
  const existing = await env.DB.prepare(
    "SELECT state,created_at FROM feedback WHERE id=?"
  )
    .bind(id)
    .first();
  if (existing?.state === "ready") return json({ id }, 200);
  if (existing) {
    if (Date.now() - Date.parse(existing.created_at) < 10 * 60 * 1000)
      throw new HttpError(409, "Invio già in corso. Attendi e riprova.");
    // Recover an upload interrupted by a terminated Worker, using deterministic IDs.
    await Promise.all(
      [0, 1, 2].map((index) =>
        cloudinaryCall(
          env,
          "destroy",
          {
            public_id: `workout-feedback/${id}/${index}`,
            type: "authenticated",
            invalidate: "true",
          },
          null,
          fetcher
        )
      )
    );
    await env.DB.prepare("DELETE FROM feedback WHERE id=? AND state='pending'")
      .bind(id)
      .run();
  }
  await rateLimit(request, env);
  const inserted = await env.DB.prepare(
    "INSERT INTO feedback (id,created_at,category,message,tester,screen,app_version) VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING RETURNING id"
  )
    .bind(
      id,
      new Date().toISOString(),
      category,
      message,
      tester,
      screen,
      version
    )
    .first();
  if (!inserted) throw new HttpError(409, "Invio già in corso.");
  const uploaded = [];
  try {
    for (let index = 0; index < files.length; index++) {
      const publicId = `workout-feedback/${id}/${index}`;
      // Track even a timed-out upload, so cleanup can delete an asset accepted remotely.
      uploaded.push({ publicId });
      const asset = await cloudinaryCall(
        env,
        "upload",
        { public_id: publicId, type: "authenticated", overwrite: "false" },
        files[index],
        fetcher
      );
      if (
        !["png", "jpg", "webp"].includes(asset.format) ||
        !Number.isInteger(asset.version)
      )
        throw new HttpError(502, "Risposta immagini non valida.");
      Object.assign(uploaded[index], {
        format: asset.format,
        version: asset.version,
      });
    }
    await env.DB.prepare(
      "UPDATE feedback SET state='ready',images=? WHERE id=?"
    )
      .bind(JSON.stringify(uploaded), id)
      .run();
    return json({ id }, 201);
  } catch (error) {
    await Promise.allSettled(
      uploaded.map((asset) =>
        cloudinaryCall(
          env,
          "destroy",
          {
            public_id: asset.publicId,
            type: "authenticated",
            invalidate: "true",
          },
          null,
          fetcher
        )
      )
    );
    await env.DB.prepare("DELETE FROM feedback WHERE id=?").bind(id).run();
    throw error;
  }
}
async function image(request, env, id, index, fetcher) {
  await admin(request, env);
  const row = await env.DB.prepare(
    "SELECT images FROM feedback WHERE id=? AND state='ready'"
  )
    .bind(id)
    .first();
  const asset = row && JSON.parse(row.images)[index];
  if (!asset) throw new HttpError(404, "Screenshot non trovato.");
  const path = `${asset.publicId}.${asset.format}`;
  const signature = btoa(
    String.fromCharCode(...(await digest(path + env.CLOUDINARY_API_SECRET)))
  )
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .slice(0, 8);
  const url = `https://res.cloudinary.com/${encodeURIComponent(
    env.CLOUDINARY_CLOUD_NAME
  )}/image/authenticated/s--${signature}--/v${asset.version}/${path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
  const response = await fetcher(url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new HttpError(502, "Screenshot non disponibile.");
  return new Response(response.body, {
    headers: {
      "Content-Type":
        asset.format === "jpg" ? "image/jpeg" : `image/${asset.format}`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
export async function handleRequest(request, env, fetcher = fetch) {
  const origin = request.headers.get("Origin");
  const allowed = (env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const headers = {
    "Cache-Control": "no-store",
    Vary: "Origin",
    "X-Content-Type-Options": "nosniff",
  };
  if (origin && !allowed.includes(origin))
    return json({ error: "Origine non autorizzata." }, 403);
  if (origin)
    Object.assign(headers, {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,Authorization",
    });
  if (request.method === "OPTIONS")
    return new Response(null, { status: 204, headers });
  let response;
  try {
    const url = new URL(request.url),
      path = url.pathname;
    if (!env.DB) throw new HttpError(503, "Database feedback non configurato.");
    if (path === "/feedback" && request.method === "POST")
      response = await submit(request, env, fetcher);
    else if (path === "/admin/feedback" && request.method === "GET") {
      await admin(request, env);
      const offset = Math.floor(
        Math.max(
          0,
          Math.min(10000, Number(url.searchParams.get("offset")) || 0)
        )
      );
      const { results } = await env.DB.prepare(
        "SELECT * FROM feedback WHERE state='ready' ORDER BY created_at DESC LIMIT 21 OFFSET ?"
      )
        .bind(offset)
        .all();
      response = json({
        items: results
          .slice(0, 20)
          .map((row) => ({
            id: row.id,
            createdAt: row.created_at,
            category: row.category,
            message: row.message,
            tester: row.tester,
            screen: row.screen,
            appVersion: row.app_version,
            status: row.status,
            imageCount: JSON.parse(row.images).length,
          })),
        hasMore: results.length > 20,
      });
    } else if (
      /^\/admin\/feedback\/[^/]+$/.test(path) &&
      request.method === "PATCH"
    ) {
      await admin(request, env);
      if (Number(request.headers.get("Content-Length")) > 1024)
        throw new HttpError(413, "Richiesta troppo grande.");
      const data = await request.json().catch(() => null);
      if (!STATUSES.includes(data?.status))
        throw new HttpError(400, "Stato non valido.");
      const result = await env.DB.prepare(
        "UPDATE feedback SET status=? WHERE id=? AND state='ready'"
      )
        .bind(data.status, path.split("/")[3])
        .run();
      if (!result.meta.changes)
        throw new HttpError(404, "Feedback non trovato.");
      response = json({ ok: true });
    } else if (
      /^\/admin\/feedback\/[^/]+\/images\/[0-2]$/.test(path) &&
      request.method === "GET"
    ) {
      const parts = path.split("/");
      response = await image(request, env, parts[3], Number(parts[5]), fetcher);
    } else response = json({ error: "Endpoint non trovato." }, 404);
  } catch (error) {
    response = json(
      {
        error:
          error instanceof HttpError
            ? error.message
            : "Servizio temporaneamente non disponibile. Riprova.",
      },
      error instanceof HttpError ? error.status : 503
    );
  }
  const result = new Response(response.body, response);
  for (const [key, value] of Object.entries(headers))
    result.headers.set(key, value);
  return result;
}
const worker = { fetch: (request, env) => handleRequest(request, env) };
export default worker;
