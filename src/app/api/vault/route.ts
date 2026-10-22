import { withRole } from "@/lib/auth/middleware";
import { createRecord, deleteRecord, findRecord, listRecords } from "@/lib/vault-store";
import { recordIdSchema, uploadSchema } from "@/lib/survey";

export const runtime = "nodejs";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export const GET = withRole("appUser", async (req, jwt) => {
  const id = new URL(req.url).searchParams.get("id");
  try {
    if (id !== null) {
      if (!recordIdSchema.safeParse(id).success) return json({ error: "Invalid record ID" }, 400);
      const record = await findRecord(jwt.sub!, id);
      // Same answer for absent and foreign records, including administrator callers.
      return record ? json({ record }) : json({ error: "Record not found" }, 404);
    }
    return json({ records: await listRecords(jwt.sub!) });
  } catch {
    return json({ error: "Records are unavailable. Please try again." }, 503);
  }
});

export const POST = withRole("appUser", async (req, jwt) => {
  if (Number(req.headers.get("content-length")) > 70 * 1024) return json({ error: "Record too large" }, 413);
  // Bound the stream before parsing, even for chunked requests without Content-Length.
  const reader = req.body?.getReader();
  if (!reader) return json({ error: "Expected an encrypted record" }, 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 70 * 1024) { await reader.cancel(); return json({ error: "Record too large" }, 413); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const parsed = uploadSchema.safeParse(JSON.parse(new TextDecoder().decode(bytes)));
    if (!parsed.success) return json({ error: "Expected only a ciphertext envelope (maximum 64 KiB)." }, 400);
    try {
      const record = await createRecord(jwt.sub!, parsed.data.ciphertext);
      return json({ record }, 201);
    } catch {
      return json({ error: "Unable to save the record. Please try again." }, 503);
    }
  } catch {
    return json({ error: "Invalid record payload" }, 400);
  } finally {
    reader.releaseLock();
  }
});

export const DELETE = withRole("appUser", async (req, jwt) => {
  const id = new URL(req.url).searchParams.get("id");
  if (!recordIdSchema.safeParse(id).success) return json({ error: "Invalid record ID" }, 400);
  try {
    return await deleteRecord(jwt.sub!, id!) ? json({ deleted: true }) : json({ error: "Record not found" }, 404);
  } catch {
    return json({ error: "Unable to delete the record. Please try again." }, 503);
  }
});
