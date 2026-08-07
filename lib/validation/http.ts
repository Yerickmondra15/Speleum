import type { ZodType } from "zod";

export class HttpBodyError extends Error {
  constructor(
    message: string,
    readonly issues?: string[],
  ) {
    super(message);
  }
}

export async function parseJsonBody<T>(
  request: Request,
  schema: ZodType<T>,
  maximumBytes = 8_192,
) {
  const declaredLength = Number(request.headers.get("content-length"));

  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
    throw new HttpBodyError(`El cuerpo supera el limite de ${maximumBytes} bytes.`);
  }

  const text = await request.text();

  if (Buffer.byteLength(text, "utf8") > maximumBytes) {
    throw new HttpBodyError(`El cuerpo supera el limite de ${maximumBytes} bytes.`);
  }

  let value: unknown;

  try {
    value = JSON.parse(text) as unknown;
  } catch {
    throw new HttpBodyError("El cuerpo JSON no es valido.");
  }

  const parsed = schema.safeParse(value);

  if (!parsed.success) {
    throw new HttpBodyError(
      "Los datos enviados no son validos.",
      parsed.error.issues.map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`),
    );
  }

  return parsed.data;
}
