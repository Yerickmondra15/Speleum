# Base de Datos de Speleum

## Tecnologia utilizada

- PostgreSQL como motor de persistencia.
- Prisma ORM como capa de acceso y definicion del schema.

## Objetivo de la base de datos

La base de datos permite que Speleum conserve informacion entre sesiones y partidas. En el estado actual del proyecto sostiene cuatro areas clave:

- autenticacion
- perfil
- ranking
- resultados y puntuaciones

## Schema real de Prisma

Los modelos activos definidos en [prisma/schema.prisma](C:/Users/yeric/Desktop/Speleum/speleum/prisma/schema.prisma) son los siguientes:

```prisma
model User {
  id                String        @id @default(cuid())
  username          String        @unique
  email             String        @unique
  passwordHash      String
  emailVerified     Boolean       @default(false)
  emailVerifiedAt   DateTime?
  twoFactorEnabled  Boolean       @default(true)
  lastLoginAt       DateTime?
  failedLoginAttempts Int         @default(0)
  activeCreature    String        @default("cave-axolotl")
  createdAt         DateTime      @default(now())
  updatedAt         DateTime      @updatedAt
  stats             UserStats?
  matchResults      MatchResult[]
  matchesWon        Match[]       @relation("MatchWinner")
  authChallenges    AuthChallenge[]
}

model AuthChallenge {
  id           String   @id @default(cuid())
  userId       String?
  email        String
  type         String
  codeHash     String
  expiresAt    DateTime
  consumedAt   DateTime?
  attemptCount Int      @default(0)
  maxAttempts  Int      @default(5)
  resendCount  Int      @default(0)
  lastSentAt   DateTime
  ipAddress    String?
  userAgent    String?
  createdAt    DateTime @default(now())
  user         User?    @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

```prisma
model UserStats {
  id            String   @id @default(cuid())
  userId        String   @unique
  matchesPlayed Int      @default(0)
  wins          Int      @default(0)
  losses        Int      @default(0)
  score         Int      @default(0)
  lastMatchAt   DateTime?
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model Match {
  id        String        @id
  mode      String
  status    String
  winnerId  String?
  startedAt DateTime      @default(now())
  endedAt   DateTime?
  winner    User?         @relation("MatchWinner", fields: [winnerId], references: [id], onDelete: SetNull)
  results   MatchResult[]
}

model MatchResult {
  id          String   @id @default(cuid())
  matchId     String
  userId      String
  creature    String
  result      String
  scoreEarned Int
  createdAt   DateTime @default(now())
  match       Match    @relation(fields: [matchId], references: [id], onDelete: Cascade)
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([matchId, userId])
}
```

## Tablas o modelos principales

### `User`

Sirve como tabla central de cuentas.

Campos relevantes:

- `username`
- `email`
- `passwordHash`
- `emailVerified`
- `lastLoginAt`
- `failedLoginAttempts`
- `activeCreature`

Uso dentro del sistema:

- registro e inicio de sesion
- sesion del usuario autenticado
- perfil visible
- criatura activa usada en partida

### `AuthChallenge`

Sirve para manejar codigos temporales de autenticacion y verificacion.

Campos relevantes:

- `email`
- `type`
- `codeHash`
- `expiresAt`
- `consumedAt`
- `attemptCount`
- `maxAttempts`
- `resendCount`
- `lastSentAt`
- `ipAddress`
- `userAgent`

Uso dentro del sistema:

- verificacion de correo
- segundo paso del login
- control de reenvios
- limite de intentos

### `UserStats`

Sirve para mantener el acumulado competitivo de cada usuario.

Campos relevantes:

- `matchesPlayed`
- `wins`
- `losses`
- `score`
- `lastMatchAt`

Uso dentro del sistema:

- perfil
- ranking
- seguimiento de avance del jugador

### `Match`

Sirve para registrar cada partida guardada por el backend.

Campos relevantes:

- `id`
- `mode`
- `status`
- `winnerId`
- `startedAt`
- `endedAt`

Uso dentro del sistema:

- soporte a resultados persistidos
- identificacion de partidas locales o multijugador
- referencia temporal para historial

### `MatchResult`

Sirve para registrar el resultado de un usuario dentro de una partida.

Campos relevantes:

- `matchId`
- `userId`
- `creature`
- `result`
- `scoreEarned`
- `createdAt`

Uso dentro del sistema:

- guardar victoria o derrota
- guardar puntos obtenidos
- vincular una partida con el usuario que la jugo

## Relaciones entre tablas

### `User` y `AuthChallenge`

- Un usuario puede tener muchos retos de autenticacion.
- Relacion: `User.authChallenges` y `AuthChallenge.user`.

### `User` y `UserStats`

- Cada usuario puede tener un solo registro de estadisticas.
- Relacion uno a uno mediante `userId`.

### `User` y `MatchResult`

- Un usuario puede tener muchos resultados de partida.
- Cada resultado pertenece a un solo usuario.

### `Match` y `MatchResult`

- Una partida puede tener varios resultados.
- Cada resultado pertenece a una unica partida.

### `User` y `Match` como ganador

- `Match.winnerId` referencia a `User.id`.
- Esto permite guardar el ganador de la partida cuando aplica.

## Justificacion basica del diseño

El diseño actual separa responsabilidades de forma clara:

- `User` concentra la identidad y el estado base de la cuenta.
- `AuthChallenge` aísla la logica temporal de codigos sin mezclarla con la cuenta principal.
- `UserStats` evita recalcular ranking cada vez desde todos los resultados.
- `Match` y `MatchResult` permiten registrar partidas y resultados sin duplicar datos de usuario.

Este esquema es adecuado para una entrega academica porque ya sostiene autenticacion, perfil, ranking y persistencia de resultados con una estructura clara y ampliable.

## Como la base de datos apoya cada modulo

### Autenticacion

- `User` guarda credenciales, verificacion y ultimo acceso.
- `AuthChallenge` gestiona codigos de verificacion y login.
- `failedLoginAttempts` y `attemptCount` ayudan a limitar errores y abusos.

### Perfil

- `User` aporta `username`, `email` y `activeCreature`.
- `UserStats` aporta partidas, victorias, derrotas, score y fecha de ultima partida.

### Ranking

- El endpoint de ranking consulta `UserStats` ordenado por `score`, `wins` y `matchesPlayed`.
- La relacion con `User` permite mostrar `username` y `activeCreature`.

### Resultados y puntuaciones

- `Match` guarda la partida.
- `MatchResult` guarda el resultado individual del jugador.
- `UserStats` se actualiza en el mismo flujo para mantener la puntuacion acumulada.

## Consideraciones actuales

- El schema ya documenta usuarios, estadisticas, partidas y resultados reales.
- No existe aun una tabla separada para salas multijugador persistidas; ese estado se mantiene en memoria del servidor de sockets.
- La estructura actual funciona como base funcional preparada para ampliacion sin contradecir la implementacion real.
