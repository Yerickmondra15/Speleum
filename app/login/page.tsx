"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  RefreshCcw,
  ShieldCheck,
  User,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { type PendingAuthState, useAuth } from "@/app/auth/AuthProvider";

type AuthMode = "login" | "register";
type AuthStep = "credentials" | "verify";

type FormErrors = {
  username?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  code?: string;
};

function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

const DUST_PARTICLES = Array.from({ length: 28 }, (_, index) => ({
  id: index,
  left: `${(index * 17) % 100}%`,
  top: `${(index * 29) % 100}%`,
  size: `${1 + (index % 3)}px`,
  delay: `${(index % 5) * 0.7}s`,
  duration: `${10 + (index % 7) * 2}s`,
}));

function FloatingDust() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {DUST_PARTICLES.map((particle) => (
        <span
          key={particle.id}
          className="absolute rounded-full bg-rose-200/10"
          style={{
            left: particle.left,
            top: particle.top,
            width: particle.size,
            height: particle.size,
            animation: `floatDust ${particle.duration} ease-in-out infinite`,
            animationDelay: particle.delay,
          }}
        />
      ))}
    </div>
  );
}

function CaveBackdrop() {
  return (
    <>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(136,19,55,0.18),transparent_30%),radial-gradient(circle_at_bottom,rgba(190,24,93,0.1),transparent_24%),linear-gradient(180deg,#020202_0%,#070707_45%,#000_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top,rgba(251,113,133,0.22),transparent_55%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-56 opacity-60">
        <svg viewBox="0 0 1440 320" className="h-full w-full fill-zinc-950">
          <path d="M0,0L0,48L70,60L115,185L165,74L242,56L299,250L358,74L444,49L497,198L544,67L630,60L688,292L751,75L841,51L898,208L959,74L1043,61L1098,305L1154,80L1239,56L1298,214L1343,73L1401,63L1440,68L1440,0Z" />
        </svg>
      </div>
      <div className="pointer-events-none absolute bottom-[-8rem] left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-rose-500/10 blur-3xl" />
      <FloatingDust />
    </>
  );
}

function ShellIcon({ step }: { step: AuthStep }) {
  return (
    <div className="relative mx-auto mb-6 flex h-28 w-28 items-center justify-center">
      <div className="absolute inset-0 rounded-full bg-rose-500/10 blur-2xl" />
      <div className="absolute inset-2 rounded-full border border-rose-300/15 bg-zinc-950/90" />
      <div className="absolute inset-[22px] rounded-full border border-white/10 bg-[radial-gradient(circle_at_top,rgba(251,113,133,0.22),rgba(9,9,11,0.9)_70%)]" />
      <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-rose-300/20 bg-black/70 text-rose-200 shadow-[0_0_40px_rgba(244,63,94,0.16)]">
        {step === "verify" ? (
          <ShieldCheck className="h-8 w-8" />
        ) : (
          <KeyRound className="h-8 w-8" />
        )}
      </div>
    </div>
  );
}

function SuccessOverlay({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-20 flex items-center justify-center rounded-[2rem] bg-black/85 backdrop-blur-md"
    >
      <div className="text-center">
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 180, damping: 16 }}
          className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-rose-400/15 text-rose-300"
        >
          <CheckCircle2 className="h-8 w-8" />
        </motion.div>
        <p className="text-lg font-semibold text-white">{message}</p>
      </div>
    </motion.div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const {
    login,
    register,
    resendCode,
    status,
    verifyEmailCode,
    verifyLoginCode,
  } = useAuth();

  const [mode, setMode] = useState<AuthMode>("login");
  const [step, setStep] = useState<AuthStep>("credentials");
  const [pendingAuth, setPendingAuth] = useState<PendingAuthState | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [countdownNow, setCountdownNow] = useState(() => Date.now());
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    code: "",
  });
  const [touched, setTouched] = useState({
    username: false,
    email: false,
    password: false,
    confirmPassword: false,
    code: false,
  });

  useEffect(() => {
    if (status === "signed-in") {
      router.replace("/");
    }
  }, [router, status]);

  useEffect(() => {
    if (!pendingAuth) {
      return;
    }

    const timer = window.setInterval(() => {
      setCountdownNow(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [pendingAuth]);

  const resendSeconds = pendingAuth
    ? Math.max(
        0,
        Math.ceil((new Date(pendingAuth.resendAvailableAt).getTime() - countdownNow) / 1000),
      )
    : 0;

  const errors = useMemo(() => {
    const nextErrors: FormErrors = {};

    if (step === "verify") {
      if (touched.code && !/^\d{6}$/.test(formData.code.trim())) {
        nextErrors.code = "Ingresa un codigo valido de 6 digitos.";
      }
      return nextErrors;
    }

    if (mode === "register" && touched.username && formData.username.trim().length < 3) {
      nextErrors.username = "El nombre debe tener al menos 3 caracteres.";
    }

    if (touched.email && !validateEmail(formData.email.trim())) {
      nextErrors.email = "Ingresa un correo valido.";
    }

    if (touched.password && formData.password.length < 6) {
      nextErrors.password = "La contrasena debe tener al menos 6 caracteres.";
    }

    if (
      mode === "register" &&
      touched.confirmPassword &&
      formData.password !== formData.confirmPassword
    ) {
      nextErrors.confirmPassword = "Las contrasenas no coinciden.";
    }

    return nextErrors;
  }, [formData, mode, step, touched]);

  const credentialFormReady =
    validateEmail(formData.email.trim()) &&
    formData.password.length >= 6 &&
    (mode === "login"
      ? true
      : formData.username.trim().length >= 3 &&
        formData.password === formData.confirmPassword &&
        formData.confirmPassword.length >= 6);

  const codeReady = /^\d{6}$/.test(formData.code.trim());

  function resetCredentialForm(nextMode?: AuthMode) {
    setMode(nextMode ?? mode);
    setStep("credentials");
    setPendingAuth(null);
    setSubmitError(null);
    setTouched({
      username: false,
      email: false,
      password: false,
      confirmPassword: false,
      code: false,
    });
    setFormData({
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
      code: "",
    });
  }

  function handleInputChange(field: keyof typeof formData, value: string) {
    setFormData((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleCredentialsSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    setTouched((current) => ({
      ...current,
      username: true,
      email: true,
      password: true,
      confirmPassword: true,
    }));

    if (!credentialFormReady) {
      return;
    }

    try {
      setIsSubmitting(true);
      const result =
        mode === "login"
          ? await login(formData.email.trim(), formData.password)
          : await register(
              formData.username.trim(),
              formData.email.trim(),
              formData.password,
            );

      if (result.status === "authenticated") {
        setSuccess(mode === "login" ? "Sesion iniciada" : "Cuenta creada");
        window.setTimeout(() => router.replace("/"), 1000);
        return;
      }

      setPendingAuth(result);
      setStep("verify");
      setFormData((current) => ({
        ...current,
        code: "",
      }));
      setTouched((current) => ({
        ...current,
        code: false,
      }));
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "No se pudo completar la autenticacion.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerifySubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    setTouched((current) => ({
      ...current,
      code: true,
    }));

    if (!pendingAuth || !codeReady) {
      return;
    }

    try {
      setIsSubmitting(true);

      if (pendingAuth.status === "pending_email_verification") {
        await verifyEmailCode(
          pendingAuth.challengeId,
          pendingAuth.email,
          formData.code.trim(),
        );
        setSuccess("Correo verificado. Bienvenido a Speleum.");
      } else {
        await verifyLoginCode(
          pendingAuth.challengeId,
          pendingAuth.email,
          formData.code.trim(),
        );
        setSuccess("Acceso confirmado.");
      }

      window.setTimeout(() => router.replace("/"), 1000);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "No se pudo validar el codigo.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResendCode() {
    if (!pendingAuth || resendSeconds > 0) {
      return;
    }

    try {
      setIsResending(true);
      setSubmitError(null);
      const nextPending = await resendCode(pendingAuth.challengeId, pendingAuth.email);
      setPendingAuth(nextPending);
      setFormData((current) => ({
        ...current,
        code: "",
      }));
      setTouched((current) => ({
        ...current,
        code: false,
      }));
    } catch (error) {
      const retryAfterSeconds =
        typeof error === "object" &&
        error !== null &&
        "retryAfterSeconds" in error &&
        typeof error.retryAfterSeconds === "number"
          ? error.retryAfterSeconds
          : undefined;

      if (typeof retryAfterSeconds === "number") {
        setPendingAuth((current) =>
          current
            ? {
                ...current,
                resendAvailableAt: new Date(
                  Date.now() + retryAfterSeconds * 1000,
                ).toISOString(),
              }
            : current,
        );
      }

      setSubmitError(
        error instanceof Error ? error.message : "No se pudo reenviar el codigo.",
      );
    } finally {
      setIsResending(false);
    }
  }

  if (status === "signed-in") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black text-zinc-400">
        Cargando...
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black px-4 py-16">
      <CaveBackdrop />

      <div className="absolute left-4 top-4 z-20 sm:left-6 sm:top-6">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/10 bg-black/45 px-4 py-2 text-sm text-zinc-300 transition hover:border-rose-300/20 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al inicio
        </Link>
      </div>

      <motion.section
        initial={{ opacity: 0, y: 24, filter: "blur(10px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-zinc-950/80 p-6 shadow-[0_30px_120px_rgba(0,0,0,0.65)] backdrop-blur-xl sm:p-8">
          <AnimatePresence>
            {success ? <SuccessOverlay message={success} /> : null}
          </AnimatePresence>

          <ShellIcon step={step} />

          <div className="mb-8 text-center">
            <p className="mb-3 text-xs uppercase tracking-[0.28em] text-rose-300/70">
              {step === "verify" ? "Verificacion segura" : "Acceso Speleum"}
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-white">
              {step === "verify"
                ? "Confirma tu codigo"
                : mode === "login"
                  ? "Entrar a la cueva"
                  : "Crear tu acceso"}
            </h1>
            <p className="mt-3 text-sm leading-6 text-zinc-400">
              {step === "verify"
                ? pendingAuth?.message ??
                  "Revisa tu correo y escribe el codigo de 6 digitos para continuar."
                : "Protegimos el acceso con verificacion por correo y 2FA en cada inicio de sesion."}
            </p>
          </div>

          {step === "credentials" ? (
            <>
              <div className="relative mb-6 flex gap-2 rounded-2xl border border-white/5 bg-black/35 p-1">
                <motion.div
                  className="absolute inset-y-1 rounded-[1rem] bg-rose-400/18"
                  initial={false}
                  animate={{
                    left: mode === "login" ? "4px" : "50%",
                    right: mode === "login" ? "50%" : "4px",
                  }}
                  transition={{ type: "spring", stiffness: 260, damping: 28 }}
                />
                <button
                  type="button"
                  onClick={() => resetCredentialForm("login")}
                  className={`relative z-10 flex-1 rounded-[1rem] px-4 py-3 text-sm font-medium transition ${
                    mode === "login" ? "text-rose-200" : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  Iniciar sesion
                </button>
                <button
                  type="button"
                  onClick={() => resetCredentialForm("register")}
                  className={`relative z-10 flex-1 rounded-[1rem] px-4 py-3 text-sm font-medium transition ${
                    mode === "register"
                      ? "text-rose-200"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  Registro
                </button>
              </div>

              <form onSubmit={handleCredentialsSubmit} noValidate className="space-y-4">
                {mode === "register" ? (
                  <div>
                    <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-zinc-500">
                      Usuario
                    </label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                      <input
                        value={formData.username}
                        onChange={(event) =>
                          handleInputChange("username", event.target.value)
                        }
                        onBlur={() =>
                          setTouched((current) => ({ ...current, username: true }))
                        }
                        autoComplete="username"
                        placeholder="Nombre de usuario"
                        className="min-h-12 w-full rounded-2xl border border-white/10 bg-black/40 py-3 pl-11 pr-4 text-white placeholder:text-zinc-600 outline-none transition focus:border-rose-300/40 focus:bg-black/55"
                      />
                    </div>
                    {errors.username ? (
                      <p className="mt-2 text-xs text-rose-300">{errors.username}</p>
                    ) : null}
                  </div>
                ) : null}

                <div>
                  <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-zinc-500">
                    Correo
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                    <input
                      value={formData.email}
                      onChange={(event) => handleInputChange("email", event.target.value)}
                      onBlur={() => setTouched((current) => ({ ...current, email: true }))}
                      autoComplete="email"
                      inputMode="email"
                      placeholder="Correo electronico"
                      className="min-h-12 w-full rounded-2xl border border-white/10 bg-black/40 py-3 pl-11 pr-4 text-white placeholder:text-zinc-600 outline-none transition focus:border-rose-300/40 focus:bg-black/55"
                    />
                  </div>
                  {errors.email ? (
                    <p className="mt-2 text-xs text-rose-300">{errors.email}</p>
                  ) : null}
                </div>

                <div>
                  <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-zinc-500">
                    Contrasena
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={(event) =>
                        handleInputChange("password", event.target.value)
                      }
                      onBlur={() => setTouched((current) => ({ ...current, password: true }))}
                      autoComplete={mode === "login" ? "current-password" : "new-password"}
                      placeholder="Contrasena"
                      className="min-h-12 w-full rounded-2xl border border-white/10 bg-black/40 py-3 pl-11 pr-11 text-white placeholder:text-zinc-600 outline-none transition focus:border-rose-300/40 focus:bg-black/55"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 transition hover:text-zinc-300"
                      aria-label={showPassword ? "Ocultar contrasena" : "Mostrar contrasena"}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {errors.password ? (
                    <p className="mt-2 text-xs text-rose-300">{errors.password}</p>
                  ) : null}
                </div>

                {mode === "register" ? (
                  <div>
                    <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-zinc-500">
                      Confirmar contrasena
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        value={formData.confirmPassword}
                        onChange={(event) =>
                          handleInputChange("confirmPassword", event.target.value)
                        }
                        onBlur={() =>
                          setTouched((current) => ({
                            ...current,
                            confirmPassword: true,
                          }))
                        }
                        autoComplete="new-password"
                        placeholder="Confirmar contrasena"
                        className="min-h-12 w-full rounded-2xl border border-white/10 bg-black/40 py-3 pl-11 pr-11 text-white placeholder:text-zinc-600 outline-none transition focus:border-rose-300/40 focus:bg-black/55"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((current) => !current)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 transition hover:text-zinc-300"
                        aria-label={
                          showConfirmPassword
                            ? "Ocultar confirmacion de contrasena"
                            : "Mostrar confirmacion de contrasena"
                        }
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    {errors.confirmPassword ? (
                      <p className="mt-2 text-xs text-rose-300">
                        {errors.confirmPassword}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {submitError ? (
                  <div className="rounded-2xl border border-rose-300/15 bg-rose-950/25 px-4 py-3 text-sm text-rose-100">
                    {submitError}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={isSubmitting || !credentialFormReady}
                  className={`min-h-12 w-full rounded-2xl px-4 py-3 text-sm font-semibold text-white transition ${
                    isSubmitting || !credentialFormReady
                      ? "bg-rose-400/20 text-zinc-500"
                      : "bg-rose-400/85 shadow-[0_16px_35px_rgba(244,63,94,0.22)] hover:bg-rose-400"
                  }`}
                >
                  {isSubmitting
                    ? "Procesando..."
                    : mode === "login"
                      ? "Continuar con seguridad"
                      : "Crear cuenta y verificar"}
                </button>
              </form>
            </>
          ) : (
            <form onSubmit={handleVerifySubmit} noValidate className="space-y-5">
              <div className="rounded-[1.75rem] border border-white/10 bg-black/35 p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                  Correo destino
                </p>
                <p className="mt-2 text-sm text-zinc-200">{pendingAuth?.email}</p>
                <p className="mt-3 text-xs leading-5 text-zinc-500">
                  {pendingAuth?.status === "pending_email_verification"
                    ? "Debes verificar este correo antes de poder usar tu cuenta."
                    : "Cada inicio de sesion requiere un codigo temporal enviado a tu correo."}
                </p>
              </div>

              {pendingAuth?.demoCode ? (
                <div className="rounded-[1.75rem] border border-amber-300/20 bg-amber-950/20 p-5">
                  <p className="text-xs uppercase tracking-[0.18em] text-amber-300/80">
                    Codigo demo
                  </p>
                  <p className="mt-2 text-3xl font-semibold tracking-[0.34em] text-amber-100">
                    {pendingAuth.demoCode}
                  </p>
                  <p className="mt-3 text-xs leading-5 text-amber-100/70">
                    Visible solo porque `DEMO_AUTH_CODES=true`. Desactivalo para un flujo normal.
                  </p>
                </div>
              ) : null}

              <div>
                <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-zinc-500">
                  Codigo de verificacion
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                  <input
                    value={formData.code}
                    onChange={(event) =>
                      handleInputChange("code", event.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    onBlur={() => setTouched((current) => ({ ...current, code: true }))}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="000000"
                    className="min-h-14 w-full rounded-2xl border border-white/10 bg-black/40 py-3 pl-11 pr-4 text-center text-2xl font-semibold tracking-[0.45em] text-white placeholder:text-zinc-600 outline-none transition focus:border-rose-300/40 focus:bg-black/55"
                  />
                </div>
                {errors.code ? (
                  <p className="mt-2 text-xs text-rose-300">{errors.code}</p>
                ) : null}
              </div>

              <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/6 bg-white/[0.03] px-4 py-3 text-sm">
                <span className="text-zinc-400">
                  {resendSeconds > 0
                    ? `Puedes reenviar en ${resendSeconds}s`
                    : "No recibiste el codigo?"}
                </span>
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={isResending || resendSeconds > 0}
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-2 transition ${
                    isResending || resendSeconds > 0
                      ? "text-zinc-600"
                      : "text-rose-200 hover:bg-rose-400/10"
                  }`}
                >
                  <RefreshCcw className="h-4 w-4" />
                  {isResending ? "Reenviando..." : "Reenviar"}
                </button>
              </div>

              {submitError ? (
                <div className="rounded-2xl border border-rose-300/15 bg-rose-950/25 px-4 py-3 text-sm text-rose-100">
                  {submitError}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={isSubmitting || !codeReady}
                className={`min-h-12 w-full rounded-2xl px-4 py-3 text-sm font-semibold text-white transition ${
                  isSubmitting || !codeReady
                    ? "bg-rose-400/20 text-zinc-500"
                    : "bg-rose-400/85 shadow-[0_16px_35px_rgba(244,63,94,0.22)] hover:bg-rose-400"
                }`}
              >
                {isSubmitting ? "Verificando..." : "Validar codigo"}
              </button>

              <button
                type="button"
                onClick={() => resetCredentialForm(mode)}
                className="w-full text-sm text-zinc-500 transition hover:text-zinc-300"
              >
                Volver y editar credenciales
              </button>
            </form>
          )}
        </div>
      </motion.section>

      <style jsx global>{`
        @keyframes floatDust {
          0%,
          100% {
            transform: translate3d(0, 0, 0);
            opacity: 0.18;
          }
          50% {
            transform: translate3d(10px, -24px, 0);
            opacity: 0.3;
          }
        }
      `}</style>
    </main>
  );
}
