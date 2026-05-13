"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  User,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "../auth/AuthProvider";

type AuthMode = "login" | "register";
type FocusedField =
  | "none"
  | "email"
  | "password"
  | "confirmPassword"
  | "username";

type FormErrors = {
  username?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
};

function validateEmail(email: string) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

function CaveParticles() {
  const [particles] = useState(() =>
    Array.from({ length: 40 }, (_, index) => ({
      id: index,
      width: `${1 + Math.random() * 3}px`,
      height: `${1 + Math.random() * 3}px`,
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      animation: `float ${10 + Math.random() * 15}s ease-in-out infinite`,
      animationDelay: `${Math.random() * 5}s`,
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
      : focusedField === "email"
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

        {/* sombra */}
        <ellipse cx="110" cy="100" rx="70" ry="12" className="fill-black/45" />

        {/* criatura */}
        <g>
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0 0; 0 -2; 0 0"
            dur="4.5s"
            repeatCount="indefinite"
          />

          {/* patas traseras */}
          <g fill="url(#crabLeg)" stroke="#18181b" strokeWidth="1.4">
            <path d="M60 64 C42 55 26 58 19 70 C31 72 46 70 61 66 Z" />
            <path d="M61 76 C43 76 29 84 25 97 C39 95 52 89 65 80 Z" />
            <path d="M160 64 C178 55 194 58 201 70 C189 72 174 70 159 66 Z" />
            <path d="M159 76 C177 76 191 84 195 97 C181 95 168 89 155 80 Z" />
          </g>

          {/* pinza izquierda */}
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
            <path
              d="M25 77 C38 69 56 71 70 76"
              className="fill-none stroke-rose-100/25"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
            <circle cx="45" cy="82" r="2.2" className="fill-rose-100/20" />
          </g>

          {/* pinza derecha */}
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
            <path
              d="M195 77 C182 69 164 71 150 76"
              className="fill-none stroke-rose-100/25"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
            <circle cx="175" cy="82" r="2.2" className="fill-rose-100/20" />
          </g>

          {/* caparazón */}
          <path
            d="M48 58 C51 32 74 19 110 19 C146 19 169 32 172 58 C169 83 145 95 110 95 C75 95 51 83 48 58 Z"
            fill="url(#crabShell)"
            stroke={showAlert ? "#fb7185" : "#27272a"}
            strokeWidth={showAlert ? "1.4" : "1"}
            className="transition-all duration-300"
          />

          {/* borde frontal */}
          <path
            d="M61 72 C76 85 91 89 110 89 C129 89 144 85 159 72 C145 79 126 82 110 82 C94 82 75 79 61 72 Z"
            className="fill-black/25"
          />

          {/* picos */}
          <g className={showAlert ? "fill-rose-200/45" : "fill-zinc-600/70"}>
            <path d="M67 38 L76 21 L85 40 Z" />
            <path d="M100 28 L110 8 L121 29 Z" />
            <path d="M136 38 L146 22 L154 41 Z" />
            <path d="M52 59 L61 48 L68 61 Z" />
            <path d="M152 61 L160 48 L168 60 Z" />
          </g>

          {/* textura de roca */}
          <g className="fill-zinc-700/30">
            <circle cx="82" cy="49" r="3" />
            <circle cx="101" cy="39" r="2.4" />
            <circle cx="121" cy="44" r="3.2" />
            <circle cx="139" cy="58" r="2.8" />
            <circle cx="72" cy="64" r="2.5" />
            <circle cx="110" cy="61" r="4" />
          </g>

          {/* brillo suave detrás */}
          <ellipse
            cx="110"
            cy="63"
            rx="58"
            ry="38"
            className={showAlert ? "fill-rose-500/10" : "fill-rose-400/5"}
          />

          {/* ojos */}
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

          {/* boca */}
          <path
            d={showAlert ? "M99 75 Q110 72 121 75" : "M97 73 Q110 80 123 73"}
            className="fill-none stroke-zinc-400/70"
            strokeWidth="1.7"
            strokeLinecap="round"
          />

          {/* alerta */}
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
  const { login, register, status } = useAuth();
  const typingTimeoutRef = useRef<number | null>(null);
  const [mode, setMode] = useState<AuthMode>("login");
  const [focusedField, setFocusedField] = useState<FocusedField>("none");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [touched, setTouched] = useState({
    username: false,
    email: false,
    password: false,
    confirmPassword: false,
  });

  useEffect(() => {
    if (status === "signed-in") {
      router.replace("/");
    }
  }, [router, status]);

  const validateForm = useMemo(() => {
    const nextErrors: FormErrors = {};

    if (mode === "register" && touched.username && formData.username.trim().length < 3) {
      nextErrors.username = "El nombre debe tener al menos 3 caracteres.";
    }

    if (touched.email && !validateEmail(formData.email)) {
      nextErrors.email = "Ingresa un correo valido.";
    }

    if (touched.password && formData.password.length < 6) {
      nextErrors.password = "La contraseña debe tener al menos 6 caracteres.";
    }

    if (
      mode === "register" &&
      touched.confirmPassword &&
      formData.password !== formData.confirmPassword
    ) {
      nextErrors.confirmPassword = "Las contraseñas no coinciden.";
    }

    return nextErrors;
  }, [formData, mode, touched]);

  const currentErrors = validateForm;

  const isFormReady =
    validateEmail(formData.email) &&
    formData.password.length >= 6 &&
    (mode === "login"
      ? true
      : formData.username.trim().length >= 3 &&
        formData.confirmPassword.length > 0 &&
        formData.password === formData.confirmPassword);

  const passwordsMatch =
    formData.confirmPassword === "" || formData.password === formData.confirmPassword;
  const showAlert =
    mode === "register" && touched.confirmPassword && !passwordsMatch;

  const handleInputChange = (field: keyof typeof formData, value: string) => {
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
  };

  const handleBlur = (field: keyof typeof touched) => {
    setTouched((current) => ({
      ...current,
      [field]: true,
    }));
    setFocusedField("none");
  };

  const handleModeChange = (nextMode: AuthMode) => {
    if (nextMode === mode) {
      return;
    }

    setMode(nextMode);
    setSubmitError(null);
    setTouched({
      username: false,
      email: false,
      password: false,
      confirmPassword: false,
    });
    setFormData({
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
    });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError(null);

    const nextTouched = {
      username: true,
      email: true,
      password: true,
      confirmPassword: true,
    };
    setTouched(nextTouched);

    const submitErrors = (() => {
      const nextErrors: FormErrors = {};

      if (mode === "register" && formData.username.trim().length < 3) {
        nextErrors.username = "El nombre debe tener al menos 3 caracteres.";
      }

      if (!validateEmail(formData.email)) {
        nextErrors.email = "Ingresa un correo valido.";
      }

      if (formData.password.length < 6) {
        nextErrors.password = "La contraseña debe tener al menos 6 caracteres.";
      }

      if (mode === "register" && formData.password !== formData.confirmPassword) {
        nextErrors.confirmPassword = "Las contraseñas no coinciden.";
      }

      return nextErrors;
    })();

    if (Object.keys(submitErrors).length > 0) {
      return;
    }

    try {
      setIsSubmitting(true);

      if (mode === "login") {
        await login(formData.email.trim(), formData.password);
      } else {
        await register(
          formData.username.trim(),
          formData.email.trim(),
          formData.password,
        );
      }

      setSuccess(
        mode === "login"
          ? "Sesión iniciada correctamente"
          : "Cuenta creada correctamente",
      );

      window.setTimeout(() => {
        router.replace("/");
      }, 1200);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "No se pudo completar la autenticación.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

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
              Entrar a Speleum
            </h1>
            <p className="mt-2 text-sm text-zinc-400">
              Inicia sesión o registra tu criatura para volver a la cueva.
            </p>
            <p className="mx-auto mt-4 max-w-xs text-xs uppercase tracking-[0.22em] text-rose-300/70">
              Seguridad reforzada, acceso rápido y experiencia inmersiva
            </p>
          </div>

          <div className="mb-6 flex justify-center">
            <CaveAxolotl focusedField={focusedField} showAlert={showAlert} />
          </div>

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
              Iniciar sesión
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

          <form onSubmit={handleSubmit} noValidate>
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
                      <p className="mt-1.5 text-xs text-rose-400">{currentErrors.username}</p>
                    )}
                  </motion.div>
                )}

                <motion.div variants={formVariants}>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                    <input
                      type="email"
                      placeholder="Correo electrónico"
                      autoComplete="email"
                      value={formData.email}
                      onChange={(event) => handleInputChange("email", event.target.value)}
                      onFocus={() => setFocusedField("email")}
                      onBlur={() => handleBlur("email")}
                      className="min-h-12 w-full rounded-xl border border-white/10 bg-black/40 py-3 pl-11 pr-4 text-white placeholder-zinc-500 outline-none transition-all focus:border-rose-400/50 focus:bg-black/50"
                    />
                  </div>
                  {currentErrors.email && (
                    <p className="mt-1.5 text-xs text-rose-400">{currentErrors.email}</p>
                  )}
                </motion.div>

                <motion.div variants={formVariants}>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Contraseña"
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
                      aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
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
                    <p className="mt-1.5 text-xs text-rose-400">{currentErrors.password}</p>
                  )}
                </motion.div>

                {mode === "register" && (
                  <motion.div variants={formVariants}>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Confirmar contraseña"
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
                        aria-label={showConfirmPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
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
                    disabled={isSubmitting || !isFormReady}
                    aria-disabled={isSubmitting || !isFormReady}
                    aria-busy={isSubmitting}
                    className={`min-h-12 w-full rounded-xl py-3 text-sm font-semibold text-white shadow-lg transition-all active:scale-[0.98] ${
                      isSubmitting || !isFormReady
                        ? "bg-rose-500/25 text-zinc-400 shadow-none"
                        : "bg-rose-400/80 shadow-rose-500/20 hover:bg-rose-400 hover:shadow-rose-500/30"
                    }`}
                  >
                    {isSubmitting
                      ? "Procesando..."
                      : mode === "login"
                        ? "Entrar"
                        : "Crear cuenta"}
                  </button>
                </motion.div>
              </motion.div>
            </AnimatePresence>
          </form>
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
