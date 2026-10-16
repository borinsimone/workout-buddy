import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  handleRequest,
  cloudinarySignature,
} from "../feedback-worker/src/index.mjs";

const origin = "https://tester.example";
function setup() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(
    readFileSync(
      new URL("../feedback-worker/schema.sql", import.meta.url),
      "utf8"
    )
  );
  const DB = {
    prepare(sql) {
      return {
        bind(...args) {
          const stmt = sqlite.prepare(sql);
          return {
            async first() {
              return stmt.get(...args) ?? null;
            },
            async all() {
              return { results: stmt.all(...args) };
            },
            async run() {
              const result = stmt.run(...args);
              return { meta: { changes: Number(result.changes) } };
            },
          };
        },
      };
    },
  };
  const env = {
    DB,
    ALLOWED_ORIGINS: origin,
    CLOUDINARY_CLOUD_NAME: "test",
    CLOUDINARY_API_KEY: "key",
    CLOUDINARY_API_SECRET: "secret",
    FEEDBACK_ADMIN_TOKEN: "a".repeat(40),
  };
  const uploads = [],
    destroyed = [],
    deliveries = [];
  const fetcher = async (url, options) => {
    if (url.includes("/image/upload")) {
      uploads.push(options.body);
      return Response.json({ format: "jpg", version: 1 });
    }
    if (url.includes("/image/destroy")) {
      destroyed.push(options.body.get("public_id"));
      return Response.json({ result: "ok" });
    }
    deliveries.push(url);
    return new Response(new Uint8Array([255, 216, 255]), {
      headers: { "Content-Type": "image/jpeg" },
    });
  };
  const request = (path, options = {}) =>
    new Request("https://api.example" + path, {
      ...options,
      headers: { Origin: origin, ...options.headers },
    });
  const adminHeaders = { Authorization: `Bearer ${env.FEEDBACK_ADMIN_TOKEN}` };
  const form = (id = crypto.randomUUID(), image = false) => {
    const data = new FormData();
    for (const [key, value] of Object.entries({
      id,
      category: "problem",
      message: "Il timer non suona",
      tester: "Tester",
      screen: "session",
      appVersion: "test",
      website: "",
    }))
      data.set(key, value);
    if (image)
      data.append(
        "images",
        new Blob([new Uint8Array([255, 216, 255, 0])], { type: "image/jpeg" }),
        "screenshot.jpg"
      );
    return data;
  };
  return {
    sqlite,
    env,
    fetcher,
    uploads,
    destroyed,
    deliveries,
    request,
    adminHeaders,
    form,
  };
}

test("feedback accepts text and authenticated images, deduplicates retries and protects administration", async () => {
  const s = setup();
  try {
    const id = crypto.randomUUID();
    const send = () =>
      handleRequest(
        s.request("/feedback", { method: "POST", body: s.form(id, true) }),
        s.env,
        s.fetcher
      );
    assert.equal((await send()).status, 201);
    assert.equal(s.uploads.length, 1);
    assert.equal(s.uploads[0].get("type"), "authenticated");
    assert.ok(s.uploads[0].get("signature"));
    assert.equal((await send()).status, 200);
    assert.equal(s.uploads.length, 1);
    assert.equal(
      (await handleRequest(s.request("/admin/feedback"), s.env)).status,
      401
    );
    assert.equal(
      (
        await handleRequest(
          s.request(`/admin/feedback/${id}/images/0`),
          s.env,
          s.fetcher
        )
      ).status,
      401
    );
    const list = await handleRequest(
      s.request("/admin/feedback", { headers: s.adminHeaders }),
      s.env
    );
    assert.equal(list.headers.get("Access-Control-Allow-Origin"), origin);
    const { items } = await list.json();
    assert.equal(items.length, 1);
    assert.equal(items[0].imageCount, 1);
    assert.equal(JSON.stringify(items).includes("publicId"), false);
    const image = await handleRequest(
      s.request(`/admin/feedback/${id}/images/0`, { headers: s.adminHeaders }),
      s.env,
      s.fetcher
    );
    assert.equal(image.status, 200);
    assert.equal(image.headers.get("Cache-Control"), "no-store");
    assert.match(
      s.deliveries[0],
      /image\/authenticated\/s--[A-Za-z0-9_-]{8}--\/v1\//
    );
    const status = await handleRequest(
      s.request(`/admin/feedback/${id}`, {
        method: "PATCH",
        headers: { ...s.adminHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "resolved" }),
      }),
      s.env
    );
    assert.equal(status.status, 200);
    assert.equal(
      s.sqlite.prepare("SELECT status FROM feedback WHERE id=?").get(id).status,
      "resolved"
    );
  } finally {
    s.sqlite.close();
  }
});

test("feedback rejects bad origin, missing configuration and invalid fields or attachments before upload", async () => {
  const s = setup();
  try {
    assert.equal(
      (
        await handleRequest(
          new Request("https://api.example/feedback", {
            method: "OPTIONS",
            headers: { Origin: "https://evil.example" },
          }),
          s.env
        )
      ).status,
      403
    );
    assert.equal(
      (
        await handleRequest(
          s.request("/feedback", { method: "OPTIONS" }),
          s.env
        )
      ).status,
      204
    );
    const body = s.form();
    body.set("message", " ");
    assert.equal(
      (
        await handleRequest(
          s.request("/feedback", { method: "POST", body }),
          s.env,
          s.fetcher
        )
      ).status,
      400
    );
    const fake = s.form();
    fake.append(
      "images",
      new Blob(["<svg/>"], { type: "image/png" }),
      "fake.png"
    );
    assert.equal(
      (
        await handleRequest(
          s.request("/feedback", { method: "POST", body: fake }),
          s.env,
          s.fetcher
        )
      ).status,
      400
    );
    const large = s.form();
    large.append(
      "images",
      new Blob([new Uint8Array(800 * 1024)], { type: "image/jpeg" }),
      "large.jpg"
    );
    assert.equal(
      (
        await handleRequest(
          s.request("/feedback", { method: "POST", body: large }),
          s.env,
          s.fetcher
        )
      ).status,
      400
    );
    const extra = s.form();
    for (let i = 0; i < 4; i++)
      extra.append(
        "images",
        new Blob([new Uint8Array([255, 216, 255])], { type: "image/jpeg" }),
        "a.jpg"
      );
    assert.equal(
      (
        await handleRequest(
          s.request("/feedback", { method: "POST", body: extra }),
          s.env,
          s.fetcher
        )
      ).status,
      400
    );
    assert.equal(
      (
        await handleRequest(
          s.request("/feedback", { method: "POST", body: s.form() }),
          { ...s.env, CLOUDINARY_API_SECRET: "" }
        )
      ).status,
      503
    );
    assert.equal(s.uploads.length, 0);
    assert.equal(
      s.sqlite.prepare("SELECT count(*) AS n FROM feedback").get().n,
      0
    );
  } finally {
    s.sqlite.close();
  }
});

test("upload failure cleans partial assets and permits retry of the same feedback", async () => {
  const s = setup();
  try {
    const id = crypto.randomUUID();
    const response = await handleRequest(
      s.request("/feedback", { method: "POST", body: s.form(id, true) }),
      s.env,
      async (url, options) =>
        url.includes("/upload")
          ? new Response("failed", { status: 500 })
          : s.fetcher(url, options)
    );
    assert.equal(response.status, 502);
    assert.equal(s.destroyed.length, 1);
    assert.equal(
      s.sqlite.prepare("SELECT count(*) AS n FROM feedback").get().n,
      0
    );
    assert.equal(
      (
        await handleRequest(
          s.request("/feedback", { method: "POST", body: s.form(id, true) }),
          s.env,
          s.fetcher
        )
      ).status,
      201
    );
  } finally {
    s.sqlite.close();
  }
});

test("submission limits block further writes and signatures match Cloudinary canonical ordering", async () => {
  const s = setup();
  try {
    for (let i = 0; i < 5; i++)
      assert.equal(
        (
          await handleRequest(
            s.request("/feedback", { method: "POST", body: s.form() }),
            s.env,
            s.fetcher
          )
        ).status,
        201
      );
    assert.equal(
      (
        await handleRequest(
          s.request("/feedback", { method: "POST", body: s.form() }),
          s.env,
          s.fetcher
        )
      ).status,
      429
    );
    assert.equal(
      s.sqlite.prepare("SELECT count(*) AS n FROM feedback").get().n,
      5
    );
    assert.equal(
      await cloudinarySignature(
        { type: "authenticated", timestamp: "123", public_id: "workout/a" },
        "secret"
      ),
      createHash("sha1")
        .update("public_id=workout/a&timestamp=123&type=authenticatedsecret")
        .digest("hex")
    );
  } finally {
    s.sqlite.close();
  }
});

test("global daily quota, stale pending recovery and invalid admin mutations", async () => {
  const s = setup();
  try {
    const id = crypto.randomUUID();
    s.sqlite
      .prepare(
        "INSERT INTO feedback (id,created_at,category,message,screen,app_version) VALUES (?,?,?,?,?,?)"
      )
      .run(
        id,
        new Date(Date.now() - 11 * 60 * 1000).toISOString(),
        "problem",
        "old",
        "session",
        "test"
      );
    assert.equal(
      (
        await handleRequest(
          s.request("/feedback", { method: "POST", body: s.form(id) }),
          s.env,
          s.fetcher
        )
      ).status,
      201
    );
    assert.equal(s.destroyed.length, 3);
    assert.equal(
      (
        await handleRequest(
          s.request("/admin/feedback", {
            headers: { Authorization: "Bearer wrong" },
          }),
          s.env
        )
      ).status,
      401
    );
    assert.equal(
      (
        await handleRequest(
          s.request(`/admin/feedback/${id}`, {
            method: "PATCH",
            headers: { ...s.adminHeaders, "Content-Type": "application/json" },
            body: JSON.stringify({ status: "invalid" }),
          }),
          s.env
        )
      ).status,
      400
    );
    for (let i = 0; i < 19; i++)
      assert.equal(
        (
          await handleRequest(
            s.request("/feedback", {
              method: "POST",
              body: s.form(),
              headers: { "CF-Connecting-IP": `test-${i}` },
            }),
            s.env,
            s.fetcher
          )
        ).status,
        201
      );
    assert.equal(
      (
        await handleRequest(
          s.request("/feedback", {
            method: "POST",
            body: s.form(),
            headers: { "CF-Connecting-IP": "another" },
          }),
          s.env,
          s.fetcher
        )
      ).status,
      429
    );
    assert.equal(
      s.sqlite.prepare("SELECT count(*) AS n FROM feedback").get().n,
      20
    );
  } finally {
    s.sqlite.close();
  }
});
