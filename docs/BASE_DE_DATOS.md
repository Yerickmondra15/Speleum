# Base de datos

## Tecnología

PostgreSQL mediante Prisma 6.19.3. `DATABASE_URL` puede apuntar al pool de ejecución y `DIRECT_URL` a la conexión directa usada por migraciones.

## Modelos

### `User`

Identidad, hash bcrypt, verificación, 2FA, criatura activa y auditoría de acceso. `failedLoginAttempts` ya tiene efecto: desde cinco fallos se escribe `lockedUntil` con espera exponencial acotada.

### `AuthChallenge`

Desafíos de verificación con hash del código, vencimiento, consumo, número máximo de intentos, reenvíos y metadatos limitados. Índices por email, usuario, tipo/estado y expiración.

### `UserStats`

Acumulado competitivo uno-a-uno con el usuario: partidas, victorias, derrotas, score y última partida. Solo resultados `server_verified` nuevos lo actualizan.

### `Match`

- `id`: UUID generado por cliente local o servidor multijugador.
- `mode`: `local` o `multiplayer` después de la validación.
- `status`: actualmente `finished` al persistir.
- `winnerId`: nulo en local; usuario ganador en multi.
- `verificationLevel`: `local_unverified` o `server_verified`.
- fechas de inicio/fin.

Incluye índice `(mode, verificationLevel, endedAt)` para consultas por confianza y fecha.

### `MatchResult`

Resultado individual, criatura y score. La restricción `@@unique([matchId, userId])` es la garantía final de idempotencia; el índice `(userId, createdAt)` soporta el historial reciente.

## Transacción de resultados

La API ejecuta una transacción `Serializable`:

1. Busca `(matchId, userId)`.
2. Si es idéntico, responde idempotentemente sin incrementar estadísticas.
3. Si existe con contenido distinto, responde `409`.
4. Valida que un `Match` existente coincida en modo, estado, ganador y nivel.
5. Crea resultado y, solo si es competitivo, actualiza `UserStats`.
6. Reintenta hasta tres veces conflictos serializables o de unicidad.

## Migración

`prisma/migrations/20260807010000_secure_results_and_login_lockout/migration.sql`:

- añade `User.lockedUntil`;
- añade `Match.verificationLevel` con valor predeterminado `local_unverified`;
- añade el índice competitivo.

No cambia ni elimina resultados previos. Por eso los acumulados históricos deben considerarse heredados hasta una auditoría de datos independiente.

## Operación

```bash
npx prisma validate
npx prisma migrate deploy
```

El build genera Prisma Client pero no requiere conexión. Las migraciones sí requieren PostgreSQL y no se ejecutan automáticamente al iniciar el frontend.
