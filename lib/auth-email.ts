import "server-only";

import { AUTH_CHALLENGE_TYPES, type AuthChallengeType } from "@/lib/auth-challenge";

type SendAuthCodeEmailInput = {
  email: string;
  code: string;
  type: AuthChallengeType;
};

export type EmailDeliveryResult =
  | { ok: true; mode: "resend" }
  | { ok: false; mode: "failed" | "not-configured"; error: string };

const EMAIL_FROM = process.env.EMAIL_FROM ?? "Speleum <onboarding@resend.dev>";
const RESEND_API_KEY = process.env.RESEND_API_KEY;

function getEmailCopy(type: AuthChallengeType) {
  if (type === AUTH_CHALLENGE_TYPES.emailVerification) {
    return {
      subject: "Verifica tu correo en Speleum",
      title: "Confirma que este correo es tuyo",
      eyebrow: "Verificacion de cuenta",
      body:
        "Usa este codigo para activar tu cuenta. Solo cuando lo confirmes podras entrar a la cueva.",
      expires: "Este codigo vence en 15 minutos.",
    };
  }

  return {
    subject: "Tu codigo de acceso a Speleum",
    title: "Completa tu inicio de sesion",
    eyebrow: "Acceso protegido",
    body:
      "Usa este codigo para terminar de iniciar sesion. Si no intentaste entrar, cambia tu contrasena.",
    expires: "Este codigo vence en 10 minutos.",
  };
}

function renderEmailHtml({
  code,
  type,
}: {
  code: string;
  type: AuthChallengeType;
}) {
  const copy = getEmailCopy(type);

  return `
<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${copy.subject}</title>
  </head>
  <body style="margin:0;padding:0;background:#050505;color:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#050505;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;border-radius:28px;overflow:hidden;background:linear-gradient(180deg,#141414 0%,#09090b 100%);border:1px solid rgba(255,255,255,0.08);box-shadow:0 30px 80px rgba(0,0,0,0.45);">
            <tr>
              <td style="padding:28px 28px 16px;background:radial-gradient(circle at top,#4c0519 0%,rgba(76,5,25,0.15) 35%,rgba(9,9,11,0) 72%);">
                <div style="font-size:12px;letter-spacing:0.24em;text-transform:uppercase;color:#fda4af;margin-bottom:14px;">
                  ${copy.eyebrow}
                </div>
                <div style="font-size:34px;line-height:1.15;font-weight:700;color:#ffffff;margin-bottom:12px;">
                  ${copy.title}
                </div>
                <div style="font-size:16px;line-height:1.65;color:#d4d4d8;max-width:520px;">
                  ${copy.body}
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 12px;">
                <div style="border-radius:26px;border:1px solid rgba(251,113,133,0.18);background:linear-gradient(180deg,rgba(24,24,27,0.95) 0%,rgba(9,9,11,0.98) 100%);padding:30px 20px;text-align:center;">
                  <div style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#a1a1aa;margin-bottom:10px;">
                    Codigo Speleum
                  </div>
                  <div style="font-size:42px;line-height:1;font-weight:800;letter-spacing:0.32em;color:#fda4af;padding-left:0.32em;">
                    ${code}
                  </div>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 28px 20px;">
                <div style="font-size:14px;line-height:1.7;color:#d4d4d8;margin-bottom:8px;">
                  ${copy.expires}
                </div>
                <div style="font-size:14px;line-height:1.7;color:#a1a1aa;">
                  Si no reconoces esta solicitud, puedes ignorar este correo.
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 28px;">
                <div style="height:1px;background:linear-gradient(90deg,rgba(244,63,94,0),rgba(244,63,94,0.6),rgba(244,63,94,0));margin-bottom:18px;"></div>
                <div style="font-size:13px;line-height:1.6;color:#71717a;">
                  Speleum · Explora la oscuridad · Acceso protegido por codigo de verificacion
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function renderEmailText({
  code,
  type,
}: {
  code: string;
  type: AuthChallengeType;
}) {
  const copy = getEmailCopy(type);

  return `${copy.title}\n\n${copy.body}\n\nCodigo: ${code}\n\n${copy.expires}\n\nSi no reconoces esta solicitud, puedes ignorar este correo.`;
}

export async function sendAuthCodeEmail(input: SendAuthCodeEmailInput) {
  const copy = getEmailCopy(input.type);
  const html = renderEmailHtml(input);
  const text = renderEmailText(input);

  if (!RESEND_API_KEY) {
    console.info(`[auth-email-preview] ${input.email} ${copy.subject} ${input.code}`);
    return {
      ok: false,
      mode: "not-configured",
      error: "No se pudo enviar el correo. Intenta de nuevo.",
    } satisfies EmailDeliveryResult;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [input.email],
        subject: copy.subject,
        html,
        text,
      }),
    });

    if (!response.ok) {
      return {
        ok: false,
        mode: "failed",
        error: "No se pudo enviar el correo. Intenta de nuevo.",
      } satisfies EmailDeliveryResult;
    }

    return {
      ok: true,
      mode: "resend",
    } satisfies EmailDeliveryResult;
  } catch {
    return {
      ok: false,
      mode: "failed",
      error: "No se pudo enviar el correo. Intenta de nuevo.",
    } satisfies EmailDeliveryResult;
  }
}
