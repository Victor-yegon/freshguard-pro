import { z } from "zod";
import { runSpoilagePrevention } from "@/backend/services/spoilage-monitor.service";

const SpoilageControllerInputSchema = z.object({
  userId: z.string().uuid(),
});

export async function runSpoilagePreventionController(input: unknown) {
  const parsed = SpoilageControllerInputSchema.parse(input);
  const result = await runSpoilagePrevention(parsed.userId);

  return {
    ok: true as const,
    message: "Spoilage monitoring run completed.",
    result,
  };
}
