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
import { readSession, writeSession } from "@/lib/session";

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

  return (
    <div className="relative flex items-center justify-center">
      <svg viewBox="0 0 160 100" className="relative h-24 w-36 overflow-visible">
        <ellipse
          cx="82"
          cy="55"
          rx="42"
          ry="24"
          className={`transition-all duration-300 ${
            showAlert ? "fill-rose-500/10" : "fill-rose-400/5"
          }`}
        />
        <path
          d="M118 58 C134 50, 147 56, 150 64 C145 68, 133 71, 118 65 Z"
          className="fill-zinc-800"
        />
        <ellipse
          cx="88"
          cy="57"
          rx="38"
          ry="21"
          className="fill-zinc-800"
        />
        <ellipse cx="48" cy="46" rx="26" ry="20" className="fill-zinc-800" />

        <g className={showAlert ? "fill-rose-300/90" : "fill-rose-400/75"}>
          <path d="M24 31 C14 20, 10 19, 14 33 C17 37, 22 37, 24 31 Z" />
          <path d="M29 27 C23 13, 19 13, 21 29 C23 34, 28 33, 29 27 Z" />
          <path d="M35 25 C33 11, 29 11, 30 26 C31 31, 35 30, 35 25 Z" />
          <path d="M61 31 C71 20, 75 19, 71 33 C68 37, 63 37, 61 31 Z" />
          <path d="M56 27 C62 13, 66 13, 64 29 C62 34, 57 33, 56 27 Z" />
          <path d="M50 25 C52 11, 56 11, 55 26 C54 31, 50 30, 50 25 Z" />
        </g>

        {isCoveringEyes ? (
          <>
            <ellipse
              cx="37"
              cy="44"
              rx="8"
              ry="5"
              transform="rotate(-18 37 44)"
              className="fill-zinc-700"
            />
            <ellipse
              cx="57"
              cy="44"
              rx="8"
              ry="5"
              transform="rotate(18 57 44)"
              className="fill-zinc-700"
            />
          </>
        ) : (
          <>
            <circle cx="39" cy="43" r="7" className="fill-white" />
            <circle cx="57" cy="43" r="7" className="fill-white" />
            <circle
              cx={
                eyePosition === "left" ? 36.5 : eyePosition === "right" ? 41.5 : 39
              }
              cy="43.5"
              r="3.2"
              className={showAlert ? "fill-rose-300" : "fill-zinc-900"}
            />
            <circle
              cx={
                eyePosition === "left" ? 54.5 : eyePosition === "right" ? 59.5 : 57
              }
              cy="43.5"
              r="3.2"
              className={showAlert ? "fill-rose-300" : "fill-zinc-900"}
            />
          </>
        )}

        {showAlert ? (
          <ellipse cx="48" cy="60" rx="4.5" ry="3.5" className="fill-zinc-900" />
        ) : (
          <path
            d="M41 58 Q48 63 55 58"
            className="fill-none stroke-zinc-500"
            strokeWidth="2"
            strokeLinecap="round"
          />
        )}
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
  const typingTimeoutRef = useRef<number | null>(null);
  const [session] = useState(() => readSession());
  const [mode, setMode] = useState<AuthMode>("login");
  const [focusedField, setFocusedField] = useState<FocusedField>("none");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
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
    if (session?.isLoggedIn) {
      router.replace("/");
    }
  }, [router, session]);

  const validateForm = useMemo(() => {
    const nextErrors: FormErrors = {};

    if (mode === "register" && touched.username && formData.username.trim().length < 3) {
      nextErrors.username = "El nombre debe tener al menos 3 caracteres.";
    }

    if (touched.email && !validateEmail(formData.email)) {
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
  }, [formData, mode, touched]);

  const currentErrors = validateForm;

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

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

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
        nextErrors.password = "La contrasena debe tener al menos 6 caracteres.";
      }

      if (mode === "register" && formData.password !== formData.confirmPassword) {
        nextErrors.confirmPassword = "Las contrasenas no coinciden.";
      }

      return nextErrors;
    })();

    if (Object.keys(submitErrors).length > 0) {
      return;
    }

    writeSession({
      username:
        mode === "register"
          ? formData.username.trim()
          : formData.email.split("@")[0]?.trim() || "spelunker",
      email: formData.email.trim(),
      isLoggedIn: true,
    });

    setSuccess(
      mode === "login"
        ? "Sesion iniciada correctamente"
        : "Cuenta creada correctamente",
    );

    window.setTimeout(() => {
      router.replace("/");
    }, 1200);
  };

  if (session?.isLoggedIn) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black text-zinc-400">
        Cargando...
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black px-4 py-12">
      <CaveParticles />
      <StalactiteBackground />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_20%,rgba(0,0,0,0.8)_80%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(30,30,30,0.4),transparent_60%)]" />
      <div className="pointer-events-none absolute bottom-0 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-rose-500/5 blur-3xl" />

      <div className="absolute left-6 top-6 z-20">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-4 py-2 text-sm text-zinc-300 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al inicio
        </Link>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30, filter: "blur(10px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/70 p-8 shadow-2xl shadow-black/50 backdrop-blur-xl">
          <AnimatePresence>
            {success && <SuccessMessage message={success} />}
          </AnimatePresence>

          <div className="mb-8 text-center">
            <h1 className="text-3xl font-semibold tracking-wide text-white">
              Entrar a Speleum
            </h1>
            <p className="mt-2 text-sm text-zinc-400">
              Inicia sesion o registra tu criatura para volver a la cueva.
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
              className={`relative z-10 flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                mode === "register"
                  ? "text-rose-300"
                  : "text-zinc-400 hover:text-zinc-300"
              }`}
            >
              Registro
            </button>
          </div>

          <form onSubmit={handleSubmit}>
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
                        value={formData.username}
                        onChange={(event) =>
                          handleInputChange("username", event.target.value)
                        }
                        onFocus={() => setFocusedField("username")}
                        onBlur={() => handleBlur("username")}
                        className="w-full rounded-xl border border-white/10 bg-black/40 py-3 pl-11 pr-4 text-white placeholder-zinc-500 outline-none transition-all focus:border-rose-400/50 focus:bg-black/50"
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
                      placeholder="Correo electronico"
                      value={formData.email}
                      onChange={(event) => handleInputChange("email", event.target.value)}
                      onFocus={() => setFocusedField("email")}
                      onBlur={() => handleBlur("email")}
                      className="w-full rounded-xl border border-white/10 bg-black/40 py-3 pl-11 pr-4 text-white placeholder-zinc-500 outline-none transition-all focus:border-rose-400/50 focus:bg-black/50"
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
                      placeholder="Contrasena"
                      value={formData.password}
                      onChange={(event) =>
                        handleInputChange("password", event.target.value)
                      }
                      onFocus={() => setFocusedField("password")}
                      onBlur={() => handleBlur("password")}
                      className="w-full rounded-xl border border-white/10 bg-black/40 py-3 pl-11 pr-11 text-white placeholder-zinc-500 outline-none transition-all focus:border-rose-400/50 focus:bg-black/50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
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
                        placeholder="Confirmar contrasena"
                        value={formData.confirmPassword}
                        onChange={(event) =>
                          handleInputChange("confirmPassword", event.target.value)
                        }
                        onFocus={() => setFocusedField("confirmPassword")}
                        onBlur={() => handleBlur("confirmPassword")}
                        className="w-full rounded-xl border border-white/10 bg-black/40 py-3 pl-11 pr-11 text-white placeholder-zinc-500 outline-none transition-all focus:border-rose-400/50 focus:bg-black/50"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((current) => !current)}
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
                  <button
                    type="submit"
                    className="w-full rounded-xl bg-rose-400/80 py-3 text-sm font-semibold text-white shadow-lg shadow-rose-500/20 transition-all hover:bg-rose-400 hover:shadow-rose-500/30 active:scale-[0.98]"
                  >
                    {mode === "login" ? "Entrar" : "Crear cuenta"}
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
