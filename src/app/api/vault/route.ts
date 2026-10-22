import { withRole } from "@/lib/auth/middleware";
import { createRecord, deleteRecord, findRecord, listRecords } from "@/lib/vault-store";
import { recordIdSchema, uploadSchema } from "@/lib/survey";

export const runtime = "nodejs";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function safeDatabaseErrorCode(error: unknown) {
  if (error && typeof error === "object") {
    const code = "code" in error && typeof error.code === "string" ? error.code : undefined;
    const name = "name" in error && typeof error.name === "string" ? error.name : "UnknownError";
    return code ? `${name}/${code}` : name;
  }
  return "UnknownError";
}

export const GET = withRole("appUser", async (req, jwt) => {
  if (jwt.demo_mode === true && !((jwt.realm_access as { roles?: string[] })?.roles ?? []).includes("_tide_decryptor")) return json({ error: "Forbidden: this simulated identity lacks _tide_decryptor." }, 403);
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
  if (jwt.demo_mode === true && !((jwt.realm_access as { roles?: string[] })?.roles ?? []).includes("_tide_encryptor")) return json({ error: "Forbidden: this simulated identity lacks _tide_encryptor." }, 403);
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
      const tideUserKey = typeof jwt.tideuserkey === "string" ? jwt.tideuserkey : "";
      const record = await createRecord(jwt.sub!, tideUserKey, parsed.data.ciphertext);
      return json({ record }, 201);
    } catch (error) {
      const diagnostic = safeDatabaseErrorCode(error);
      console.error(`[vault] createRecord failed: ${diagnostic}`);
      const message = process.env.NODE_ENV === "development"
        ? `Unable to save the record (${diagnostic}). Please try again.`
        : "Unable to save the record. Please try again.";
      return json({ error: message }, 503);
    }
  } catch {
    return json({ error: "Invalid record payload" }, 400);
  } finally {
    reader.releaseLock();
  }
});

export const DELETE = withRole("appUser", async (req, jwt) => {
  if (jwt.demo_mode === true && !((jwt.realm_access as { roles?: string[] })?.roles ?? []).includes("_tide_encryptor")) return json({ error: "Forbidden: this simulated identity lacks _tide_encryptor." }, 403);
  const id = new URL(req.url).searchParams.get("id");
  if (!recordIdSchema.safeParse(id).success) return json({ error: "Invalid record ID" }, 400);
  try {
    return await deleteRecord(jwt.sub!, id!) ? json({ deleted: true }) : json({ error: "Record not found" }, 404);
  } catch {
    return json({ error: "Unable to delete the record. Please try again." }, 503);
  }
});
