import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { runSpoilagePreventionController } from "@/backend/controllers/spoilage.controller";

const SpoilageInputSchema = z.object({
  userId: z.string().uuid(),
  force: z.boolean().optional(),
});

export const runSpoilagePreventionScan = createServerFn({ method: "POST" })
  .inputValidator(SpoilageInputSchema)
  .handler(async ({ data }) => {
    return await runSpoilagePreventionController(data);
  });
