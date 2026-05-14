"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
import { AnimatePresence, motion } from "framer-motion";

import { type PendingAuthState, useAuth } from "@/app/auth/AuthProvider";

type AuthMode = "login" | "register";
type AuthStep = "credentials" | "verify";
type FocusedField =
  | "none"
  | "email"
  | "password"
  | "confirmPassword"
  | "username"
  | "code";

type FormErrors = {
  username?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  code?: string;
};

function validateEmail(email: string) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

function CaveParticles() {
  const [particles] = useState(() =>
    Array.from({ length: 40 }, (_, index) => ({
      id: index,
      width: `${1 + (index % 3)}px`,
      height: `${1 + ((index + 1) % 3)}px`,
      left: `${(index * 17) % 100}%`,
      top: `${(index * 23) % 100}%`,
      animation: `float ${10 + (index % 6) * 2}s ease-in-out infinite`,
      animationDelay: `${(index % 5) * 0.6}s`,
    })),
  );

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden">
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute rounded-full bg-zinc-400/15"
          style={{
            width: particle.width,
            height: particle.height,
            left: particle.left,
            top: particle.top,
            animation: particle.animation,
            animationDelay: particle.animationDelay,
          }}
        />
      ))}
    </div>
  );
}

function StalactiteBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden">
      <svg
        className="absolute -top-4 left-0 h-[45vh] w-full opacity-30"
        viewBox="0 0 1400 400"
        preserveAspectRatio="none"
      >
        <defs>
          <filter id="blur-far">
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>
        <path
          filter="url(#blur-far)"
          d="M0,0 L0,40 L80,50 L100,180 L120,60 L200,55 L230,280 L260,70 L340,45 L380,220 L400,55 L500,65 L540,320 L580,80 L680,50 L720,260 L760,65 L860,55 L900,350 L940,75 L1040,50 L1080,240 L1120,60 L1200,70 L1240,300 L1280,55 L1360,45 L1400,50 L1400,0 Z"
          className="fill-zinc-950"
        />
      </svg>

      <svg
        className="absolute -top-2 left-0 h-[35vh] w-full opacity-50"
        viewBox="0 0 1400 350"
        preserveAspectRatio="none"
      >
        <defs>
          <filter id="blur-mid">
            <feGaussianBlur stdDeviation="1.5" />
          </filter>
        </defs>
        <path
          filter="url(#blur-mid)"
          d="M0,0 L0,30 L60,40 L80,150 L100,50 L160,45 L190,200 L220,55 L300,50 L340,250 L380,60 L460,45 L500,180 L540,55 L620,50 L660,280 L700,65 L780,55 L820,220 L860,60 L940,45 L980,260 L1020,55 L1100,50 L1140,190 L1180,60 L1260,55 L1300,230 L1340,50 L1400,45 L1400,0 Z"
          className="fill-zinc-900"
        />
      </svg>

      <svg
        className="absolute top-0 left-0 h-[25vh] w-full"
        viewBox="0 0 1400 250"
        preserveAspectRatio="none"
      >
        <path
          d="M0,0 L0,25 L40,30 L55,90 L70,35 L120,40 L140,140 L160,45 L210,35 L240,180 L270,50 L330,40 L360,120 L390,45 L450,38 L480,200 L510,50 L570,42 L600,150 L630,48 L690,35 L720,170 L750,45 L810,40 L850,220 L890,50 L950,38 L980,130 L1010,45 L1070,42 L1110,190 L1150,48 L1210,35 L1250,160 L1290,45 L1350,40 L1380,110 L1400,45 L1400,0 Z"
          className="fill-zinc-950"
        />
      </svg>
    </div>
  );
}

function CaveAxolotl({
  focusedField,
  showAlert,
}: {
  focusedField: FocusedField;
  showAlert: boolean;
}) {
  const eyePosition =
    focusedField === "password" || focusedField === "confirmPassword"
      ? "closed"
      : focusedField === "email" || focusedField === "code"
        ? "right"
        : focusedField === "username"
          ? "left"
          : "center";

  const isCoveringEyes = eyePosition === "closed";
  const pupilOffset =
    eyePosition === "left" ? -2.5 : eyePosition === "right" ? 2.5 : 0;
  const eyeColor = showAlert ? "#ffe0ea" : "#f4f4f5";
  const eyeGlow = showAlert ? "0.9" : "0.45";

  return (
    <div className="relative flex items-center justify-center py-1">
      <svg
        viewBox="0 0 220 125"
        className="relative h-28 w-44 overflow-visible"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="crabEyeGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffe4ec" />
            <stop offset="55%" stopColor="#fb7185" />
            <stop offset="100%" stopColor="#fb718500" />
          </radialGradient>

          <linearGradient id="crabShell" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={showAlert ? "#30272d" : "#29292e"} />
            <stop offset="100%" stopColor="#111113" />
          </linearGradient>

          <linearGradient id="crabClaw" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={showAlert ? "#9b5c6b" : "#6b4a55"} />
            <stop offset="100%" stopColor={showAlert ? "#4a222d" : "#32242a"} />
          </linearGradient>

          <linearGradient id="crabLeg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#27272c" />
            <stop offset="100%" stopColor="#09090b" />
          </linearGradient>
        </defs>

        <ellipse cx="110" cy="100" rx="70" ry="12" className="fill-black/45" />

        <g>
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0 0; 0 -2; 0 0"
            dur="4.5s"
            repeatCount="indefinite"
          />

          <g fill="url(#crabLeg)" stroke="#18181b" strokeWidth="1.4">
            <path d="M60 64 C42 55 26 58 19 70 C31 72 46 70 61 66 Z" />
            <path d="M61 76 C43 76 29 84 25 97 C39 95 52 89 65 80 Z" />
            <path d="M160 64 C178 55 194 58 201 70 C189 72 174 70 159 66 Z" />
            <path d="M159 76 C177 76 191 84 195 97 C181 95 168 89 155 80 Z" />
          </g>

          <g
            className="transition-all duration-300"
            transform={
              isCoveringEyes
                ? "translate(15 -8) rotate(13 70 76)"
                : showAlert
                  ? "translate(-2 -5) rotate(-8 70 76)"
                  : "rotate(-2 70 76)"
            }
          >
            <path
              d="M52 76 C36 61 17 63 11 79 C7 93 23 105 42 98 C55 94 64 84 72 72 Z"
              fill="url(#crabClaw)"
              stroke="#111113"
              strokeWidth="1.8"
            />
            <path
              d="M72 72 C55 68 42 73 36 88 C51 88 63 82 75 73 Z"
              className="fill-zinc-950"
            />
          </g>

          <g
            className="transition-all duration-300"
            transform={
              isCoveringEyes
                ? "translate(-15 -8) rotate(-13 150 76)"
                : showAlert
                  ? "translate(2 -5) rotate(8 150 76)"
                  : "rotate(2 150 76)"
            }
          >
            <path
              d="M168 76 C184 61 203 63 209 79 C213 93 197 105 178 98 C165 94 156 84 148 72 Z"
              fill="url(#crabClaw)"
              stroke="#111113"
              strokeWidth="1.8"
            />
            <path
              d="M148 72 C165 68 178 73 184 88 C169 88 157 82 145 73 Z"
              className="fill-zinc-950"
            />
          </g>

          <path
            d="M48 58 C51 32 74 19 110 19 C146 19 169 32 172 58 C169 83 145 95 110 95 C75 95 51 83 48 58 Z"
            fill="url(#crabShell)"
            stroke={showAlert ? "#fb7185" : "#27272a"}
            strokeWidth={showAlert ? "1.4" : "1"}
            className="transition-all duration-300"
          />

          <path
            d="M61 72 C76 85 91 89 110 89 C129 89 144 85 159 72 C145 79 126 82 110 82 C94 82 75 79 61 72 Z"
            className="fill-black/25"
          />

          <g className={showAlert ? "fill-rose-200/45" : "fill-zinc-600/70"}>
            <path d="M67 38 L76 21 L85 40 Z" />
            <path d="M100 28 L110 8 L121 29 Z" />
            <path d="M136 38 L146 22 L154 41 Z" />
            <path d="M52 59 L61 48 L68 61 Z" />
            <path d="M152 61 L160 48 L168 60 Z" />
          </g>

          <ellipse
            cx="110"
            cy="63"
            rx="58"
            ry="38"
            className={showAlert ? "fill-rose-500/10" : "fill-rose-400/5"}
          />

          <g>
            <circle
              cx="88"
              cy="60"
              r="15"
              fill="url(#crabEyeGlow)"
              opacity={eyeGlow}
            />
            <circle
              cx="132"
              cy="60"
              r="15"
              fill="url(#crabEyeGlow)"
              opacity={eyeGlow}
            />

            {isCoveringEyes ? (
              <g
                className="fill-none stroke-rose-100/70"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M79 61 C84 65 92 65 97 61" />
                <path d="M123 61 C128 65 136 65 141 61" />
              </g>
            ) : (
              <>
                <circle cx="88" cy="60" r="7.3" fill={eyeColor} />
                <circle cx="132" cy="60" r="7.3" fill={eyeColor} />
                <circle
                  cx={88 + pupilOffset}
                  cy="61"
                  r="3"
                  className={showAlert ? "fill-rose-500" : "fill-zinc-950"}
                />
                <circle
                  cx={132 + pupilOffset}
                  cy="61"
                  r="3"
                  className={showAlert ? "fill-rose-500" : "fill-zinc-950"}
                />
                <circle cx="85" cy="57" r="1.4" className="fill-white/70" />
                <circle cx="129" cy="57" r="1.4" className="fill-white/70" />
              </>
            )}
          </g>

          <path
            d={showAlert ? "M99 75 Q110 72 121 75" : "M97 73 Q110 80 123 73"}
            className="fill-none stroke-zinc-400/70"
            strokeWidth="1.7"
            strokeLinecap="round"
          />

          {showAlert && (
            <g className="stroke-rose-300/80" strokeWidth="1.8" strokeLinecap="round">
              <path d="M48 35 L39 26" />
              <path d="M172 35 L181 26" />
              <path d="M110 12 L110 3" />
            </g>
          )}
        </g>
      </svg>
    </div>
  );
}

function SuccessMessage({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-20 flex items-center justify-center rounded-3xl bg-black/90 backdrop-blur-sm"
    >
      <div className="text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-rose-400/20"
        >
          <CheckCircle2 className="h-8 w-8 text-rose-400" />
        </motion.div>
        <p className="text-lg font-medium text-white">{message}</p>
      </div>
    </motion.div>
  );
}

const formVariants = {
  hidden: {
    opacity: 0,
    y: 20,
    filter: "blur(4px)",
  },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.4 },
  },
  exit: {
    opacity: 0,
    y: -20,
    filter: "blur(4px)",
    transition: { duration: 0.3 },
  },
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      staggerChildren: 0.05,
      staggerDirection: -1 as const,
    },
  },
};

export default function LoginPage() {
  const router = useRouter();
  const { login, register, resendCode, status, verifyEmailCode, verifyLoginCode } =
    useAuth();
  const typingTimeoutRef = useRef<number | null>(null);
  const [mode, setMode] = useState<AuthMode>("login");
  const [step, setStep] = useState<AuthStep>("credentials");
  const [focusedField, setFocusedField] = useState<FocusedField>("none");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pendingAuth, setPendingAuth] = useState<PendingAuthState | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [countdownNow, setCountdownNow] = useState(() => Date.now());
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

  const currentErrors = useMemo(() => {
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

  const isCredentialFormReady =
    validateEmail(formData.email.trim()) &&
    formData.password.length >= 6 &&
    (mode === "login"
      ? true
      : formData.username.trim().length >= 3 &&
        formData.confirmPassword.length > 0 &&
        formData.password === formData.confirmPassword);

  const isCodeReady = /^\d{6}$/.test(formData.code.trim());
  const showAlert =
    step === "credentials" &&
    mode === "register" &&
    touched.confirmPassword &&
    formData.confirmPassword.length > 0 &&
    formData.password !== formData.confirmPassword;

  const isDemoCodeVisible = Boolean(pendingAuth?.demoCode);

  function handleInputChange(field: keyof typeof formData, value: string) {
    setFormData((current) => ({
      ...current,
      [field]: value,
    }));

    if (typingTimeoutRef.current !== null) {
      window.clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = window.setTimeout(() => {
      typingTimeoutRef.current = null;
    }, 500);
  }

  function handleBlur(field: keyof typeof touched) {
    setTouched((current) => ({
      ...current,
      [field]: true,
    }));
    setFocusedField("none");
  }

  function resetVerificationState(nextMode?: AuthMode) {
    setMode(nextMode ?? mode);
    setStep("credentials");
    setPendingAuth(null);
    setSubmitError(null);
    setFocusedField("none");
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

  function handleModeChange(nextMode: AuthMode) {
    if (nextMode === mode) {
      return;
    }

    resetVerificationState(nextMode);
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

    if (!isCredentialFormReady) {
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
        setSuccess(
          mode === "login"
            ? "Sesion iniciada correctamente"
            : "Cuenta creada correctamente",
        );
        window.setTimeout(() => {
          router.replace("/");
        }, 1200);
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
        error instanceof Error ? error.message : "No se pudo completar la autenticacion.",
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

    if (!pendingAuth || !isCodeReady) {
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

      window.setTimeout(() => {
        router.replace("/");
      }, 1200);
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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black px-4 py-20 sm:py-12">
      <CaveParticles />
      <StalactiteBackground />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_20%,rgba(0,0,0,0.8)_80%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(30,30,30,0.4),transparent_60%)]" />
      <div className="pointer-events-none absolute bottom-0 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-rose-500/5 blur-3xl" />

      <div className="absolute left-4 top-4 z-20 sm:left-6 sm:top-6">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/10 bg-black/40 px-4 py-2 text-sm text-zinc-300 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al inicio
        </Link>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30, filter: "blur(10px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative z-10 w-full max-w-md pt-10 sm:pt-0"
      >
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/70 p-5 shadow-2xl shadow-black/50 backdrop-blur-xl sm:p-8">
          <AnimatePresence>
            {success && <SuccessMessage message={success} />}
          </AnimatePresence>

          <div className="mb-8 text-center">
            <h1 className="text-2xl font-semibold tracking-wide text-white sm:text-3xl">
              {step === "verify" ? "Verificar acceso" : "Acceder a Speleum"}
            </h1>
            <p className="mt-2 text-sm text-zinc-400">
              {step === "verify"
                ? pendingAuth?.message ??
                  "Revisa tu correo y escribe el codigo de 6 digitos para continuar."
                : "Inicia sesion o registra tu cuenta para guardar perfil, ranking y progreso de partida."}
            </p>
            <p className="mx-auto mt-4 max-w-xs text-xs uppercase tracking-[0.22em] text-rose-300/70">
              {step === "verify"
                ? "Confirmacion segura, codigo temporal y acceso protegido"
                : "Seguridad reforzada, acceso rapido y experiencia inmersiva"}
            </p>
          </div>

          <div className="mb-6 flex justify-center">
            <CaveAxolotl focusedField={focusedField} showAlert={showAlert} />
          </div>

          {step === "credentials" ? (
            <>
              <div className="relative mb-6 flex gap-2 rounded-xl bg-black/30 p-1">
                <motion.div
                  className="absolute inset-y-1 rounded-lg bg-rose-400/20"
                  initial={false}
                  animate={{
                    left: mode === "login" ? "4px" : "50%",
                    right: mode === "login" ? "50%" : "4px",
                  }}
                  transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 30,
                  }}
                />
                <button
                  type="button"
                  onClick={() => handleModeChange("login")}
                  aria-pressed={mode === "login"}
                  className={`relative z-10 flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                    mode === "login"
                      ? "text-rose-300"
                      : "text-zinc-400 hover:text-zinc-300"
                  }`}
                >
                  Iniciar sesion
                </button>
                <button
                  type="button"
                  onClick={() => handleModeChange("register")}
                  aria-pressed={mode === "register"}
                  className={`relative z-10 flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                    mode === "register"
                      ? "text-rose-300"
                      : "text-zinc-400 hover:text-zinc-300"
                  }`}
                >
                  Registro
                </button>
              </div>

              <form onSubmit={handleCredentialsSubmit} noValidate>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={mode}
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="space-y-4"
                  >
                    {mode === "register" && (
                      <motion.div variants={formVariants}>
                        <div className="relative">
                          <User className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                          <input
                            type="text"
                            placeholder="Nombre de usuario"
                            autoComplete="username"
                            minLength={3}
                            value={formData.username}
                            onChange={(event) =>
                              handleInputChange("username", event.target.value)
                            }
                            onFocus={() => setFocusedField("username")}
                            onBlur={() => handleBlur("username")}
                            className="min-h-12 w-full rounded-xl border border-white/10 bg-black/40 py-3 pl-11 pr-4 text-white placeholder-zinc-500 outline-none transition-all focus:border-rose-400/50 focus:bg-black/50"
                          />
                        </div>
                        {currentErrors.username && (
                          <p className="mt-1.5 text-xs text-rose-400">
                            {currentErrors.username}
                          </p>
                        )}
                      </motion.div>
                    )}

                    <motion.div variants={formVariants}>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                        <input
                          type="email"
                          placeholder="Correo electronico"
                          autoComplete="email"
                          value={formData.email}
                          onChange={(event) => handleInputChange("email", event.target.value)}
                          onFocus={() => setFocusedField("email")}
                          onBlur={() => handleBlur("email")}
                          className="min-h-12 w-full rounded-xl border border-white/10 bg-black/40 py-3 pl-11 pr-4 text-white placeholder-zinc-500 outline-none transition-all focus:border-rose-400/50 focus:bg-black/50"
                        />
                      </div>
                      {currentErrors.email && (
                        <p className="mt-1.5 text-xs text-rose-400">
                          {currentErrors.email}
                        </p>
                      )}
                    </motion.div>

                    <motion.div variants={formVariants}>
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                        <input
                          type={showPassword ? "text" : "password"}
                          placeholder="Contrasena"
                          autoComplete={mode === "login" ? "current-password" : "new-password"}
                          minLength={6}
                          value={formData.password}
                          onChange={(event) =>
                            handleInputChange("password", event.target.value)
                          }
                          onFocus={() => setFocusedField("password")}
                          onBlur={() => handleBlur("password")}
                          className="min-h-12 w-full rounded-xl border border-white/10 bg-black/40 py-3 pl-11 pr-11 text-white placeholder-zinc-500 outline-none transition-all focus:border-rose-400/50 focus:bg-black/50"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((current) => !current)}
                          aria-label={showPassword ? "Ocultar contrasena" : "Mostrar contrasena"}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 transition-colors hover:text-zinc-300"
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                      {currentErrors.password && (
                        <p className="mt-1.5 text-xs text-rose-400">
                          {currentErrors.password}
                        </p>
                      )}
                    </motion.div>

                    {mode === "register" && (
                      <motion.div variants={formVariants}>
                        <div className="relative">
                          <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                          <input
                            type={showConfirmPassword ? "text" : "password"}
                            placeholder="Confirmar contrasena"
                            autoComplete="new-password"
                            minLength={6}
                            value={formData.confirmPassword}
                            onChange={(event) =>
                              handleInputChange("confirmPassword", event.target.value)
                            }
                            onFocus={() => setFocusedField("confirmPassword")}
                            onBlur={() => handleBlur("confirmPassword")}
                            className="min-h-12 w-full rounded-xl border border-white/10 bg-black/40 py-3 pl-11 pr-11 text-white placeholder-zinc-500 outline-none transition-all focus:border-rose-400/50 focus:bg-black/50"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword((current) => !current)}
                            aria-label={
                              showConfirmPassword
                                ? "Ocultar confirmacion de contrasena"
                                : "Mostrar confirmacion de contrasena"
                            }
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 transition-colors hover:text-zinc-300"
                          >
                            {showConfirmPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                        {currentErrors.confirmPassword && (
                          <p className="mt-1.5 text-xs text-rose-400">
                            {currentErrors.confirmPassword}
                          </p>
                        )}
                      </motion.div>
                    )}

                    <motion.div variants={formVariants}>
                      {submitError && (
                        <div
                          role="alert"
                          className="rounded-xl border border-rose-400/20 bg-rose-950/30 px-4 py-3 text-sm text-rose-200"
                        >
                          {submitError}
                        </div>
                      )}
                    </motion.div>

                    <motion.div variants={formVariants}>
                      <button
                        type="submit"
                        disabled={isSubmitting || !isCredentialFormReady}
                        aria-disabled={isSubmitting || !isCredentialFormReady}
                        aria-busy={isSubmitting}
                        className={`min-h-12 w-full rounded-xl py-3 text-sm font-semibold text-white shadow-lg transition-all active:scale-[0.98] ${
                          isSubmitting || !isCredentialFormReady
                            ? "bg-rose-500/25 text-zinc-400 shadow-none"
                            : "bg-rose-400/80 shadow-rose-500/20 hover:bg-rose-400 hover:shadow-rose-500/30"
                        }`}
                      >
                        {isSubmitting
                          ? "Procesando..."
                          : mode === "login"
                            ? "Continuar"
                            : "Crear cuenta"}
                      </button>
                    </motion.div>
                  </motion.div>
                </AnimatePresence>
              </form>
            </>
          ) : (
            <form onSubmit={handleVerifySubmit} noValidate className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-zinc-300">
                <div className="mb-1 flex items-center gap-2 text-rose-300">
                  <ShieldCheck className="h-4 w-4" />
                  <span className="font-medium">Correo destino</span>
                </div>
                <p className="text-white">{pendingAuth?.email}</p>
                <p className="mt-2 text-xs text-zinc-500">
                  {pendingAuth?.status === "pending_email_verification"
                    ? "Debes verificar este correo antes de poder usar tu cuenta."
                    : "Cada inicio de sesion requiere un codigo temporal enviado a tu correo."}
                </p>
              </div>

              {isDemoCodeVisible && (
                <details className="rounded-2xl border border-amber-300/15 bg-amber-950/15 p-4 text-amber-100">
                  <summary className="cursor-pointer text-sm font-medium">
                    Codigo demo
                  </summary>
                  <p className="mt-3 text-xs uppercase tracking-[0.18em] text-amber-200/70">
                    Visible porque el modo demo publico esta activo
                  </p>
                  <p className="mt-2 text-2xl font-semibold tracking-[0.34em]">
                    {pendingAuth?.demoCode}
                  </p>
                </details>
              )}

              <div className="relative">
                <KeyRound className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="Codigo de 6 digitos"
                  value={formData.code}
                  onChange={(event) =>
                    handleInputChange("code", event.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  onFocus={() => setFocusedField("code")}
                  onBlur={() => handleBlur("code")}
                  className="min-h-12 w-full rounded-xl border border-white/10 bg-black/40 py-3 pl-11 pr-4 text-white placeholder-zinc-500 outline-none transition-all focus:border-rose-400/50 focus:bg-black/50"
                />
              </div>
              {currentErrors.code && (
                <p className="-mt-2 text-xs text-rose-400">{currentErrors.code}</p>
              )}

              <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm">
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

              {submitError && (
                <div
                  role="alert"
                  className="rounded-xl border border-rose-400/20 bg-rose-950/30 px-4 py-3 text-sm text-rose-200"
                >
                  {submitError}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || !isCodeReady}
                aria-disabled={isSubmitting || !isCodeReady}
                aria-busy={isSubmitting}
                className={`min-h-12 w-full rounded-xl py-3 text-sm font-semibold text-white shadow-lg transition-all active:scale-[0.98] ${
                  isSubmitting || !isCodeReady
                    ? "bg-rose-500/25 text-zinc-400 shadow-none"
                    : "bg-rose-400/80 shadow-rose-500/20 hover:bg-rose-400 hover:shadow-rose-500/30"
                }`}
              >
                {isSubmitting ? "Verificando..." : "Validar codigo"}
              </button>

              <button
                type="button"
                onClick={() => resetVerificationState(mode)}
                className="w-full text-sm text-zinc-500 transition hover:text-zinc-300"
              >
                Volver y editar credenciales
              </button>
            </form>
          )}
        </div>
      </motion.div>

      <style jsx global>{`
        @keyframes float {
          0%,
          100% {
            transform: translateY(0) translateX(0);
            opacity: 0.15;
          }
          25% {
            transform: translateY(-30px) translateX(15px);
            opacity: 0.25;
          }
          50% {
            transform: translateY(-15px) translateX(-10px);
            opacity: 0.1;
          }
          75% {
            transform: translateY(-40px) translateX(5px);
            opacity: 0.2;
          }
        }
      `}</style>
    </main>
  );
}
