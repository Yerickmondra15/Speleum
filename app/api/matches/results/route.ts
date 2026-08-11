import { NextResponse } from "next/server";

import { requireCurrentUser } from "@/lib/auth";
import {
  MatchResultPolicyError,
  matchResultRequestSchema,
  verifyMatchResultRequest,
} from "@/lib/matches/result-contract";
import {
  persistMatchResults,
  ResultConflictError,
} from "@/lib/matches/result-persistence";
import { getMultiplayerResultSecret } from "@/lib/security/secrets";
import { HttpBodyError, parseJsonBody } from "@/lib/validation/http";

export async function POST(request: Request) {
  try {
    const currentUser = await requireCurrentUser();
    const body = await parseJsonBody(request, matchResultRequestSchema);
    const verified = verifyMatchResultRequest({
      request: body,
      currentUserId: currentUser.id,
      resultSecret: getMultiplayerResultSecret(),
    });
    const [saved] = await persistMatchResults([
      { userId: currentUser.id, result: verified },
    ]);

    return NextResponse.json(
      {
        id: saved.id,
        idempotent: !saved.created,
        competitive: verified.competitive,
        scoreEarned: verified.scoreEarned,
      },
      { status: saved.created ? 201 : 200 },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

    if (error instanceof HttpBodyError) {
      return NextResponse.json(
        { error: error.message, issues: error.issues },
        { status: 400 },
      );
    }

    if (error instanceof MatchResultPolicyError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.code === "INVALID_DURATION" ? 400 : 403 },
      );
    }

    if (error instanceof ResultConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    console.error("[matches/results] No se pudo guardar el resultado.", error);
    return NextResponse.json(
      { error: "No se pudo guardar el resultado." },
      { status: 500 },
    );
  }
}
