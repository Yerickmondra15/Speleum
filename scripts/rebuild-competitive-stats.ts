import { prisma } from "../lib/prisma";
import { rebuildCompetitiveUserStats } from "../lib/stats/rebuild-competitive-stats";

async function main() {
  const apply = process.argv.includes("--apply");
  const report = await rebuildCompetitiveUserStats({ dryRun: !apply });

  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        ...report,
      },
      null,
      2,
    ),
  );

  if (apply) {
    const verification = await rebuildCompetitiveUserStats({ dryRun: true });
    console.log(
      JSON.stringify(
        {
          mode: "post-apply-verification",
          remainingChanges: verification.changes,
          totals: verification.totals,
          currentStats: verification.before,
        },
        null,
        2,
      ),
    );
  }
}

main().finally(() => prisma.$disconnect());
