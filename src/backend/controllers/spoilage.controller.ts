import { z } from "zod";
import { runSpoilagePrevention } from "@/backend/services/spoilage-monitor.service";

const SpoilageControllerInputSchema = z.object({
  userId: z.string().uuid(),
});

export async function runSpoilagePreventionController(input: unknown) {
  try {
    const parsed = SpoilageControllerInputSchema.parse(input);
    console.log(`[Spoilage Controller] Processing request for user: ${parsed.userId}`);
    
    const result = await runSpoilagePrevention(parsed.userId);

    console.log(`[Spoilage Controller] Scan completed successfully:`, result);
    
    return {
      ok: true as const,
      message: "Spoilage monitoring run completed.",
      result,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Spoilage Controller] Error during scan:`, errorMessage);
    console.error(`[Spoilage Controller] Full error:`, error);
    
    throw error;
  }
}
