import { NextRequest, NextResponse } from "next/server";
import { enqueue } from "@/utilities/queue";
import { redis } from "@/lib/queue";
import { retry } from "@/lib/retry";
import { withIdempotency } from "@/utilities/idempotency";
import { validateJWTMiddleware } from "@/lib/jwt-validate";
import { rateLimitMiddleware } from "@/lib/middleware/rate-limit";
import { pushRequestSchema, pushGameDataSchema, likesSchema } from "@/types/validation";
import { tryApiRoute } from "@/utilities/apiErrorHandler";

export async function POST(request: NextRequest) {
   const { error } = await validateJWTMiddleware(request);
   if (error) return error;

   try {
     await rateLimitMiddleware(request);
   } catch {
     return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
   }

   return tryApiRoute(async () => {
     const body = await request.json();

     const validationResult = pushRequestSchema.safeParse(body);
     if (!validationResult.success) {
       return NextResponse.json(
         { error: "Invalid request body", details: validationResult.error.issues },
         { status: 400 }
       );
     }

     const { idempotencyKey, type, data } = validationResult.data;

     const { result, cached } = await withIdempotency(idempotencyKey, async () => {
       if (type === "game") {
         const gameValidation = pushGameDataSchema.safeParse(data);
         if (!gameValidation.success) {
           return NextResponse.json(
             { error: "Invalid game data", details: gameValidation.error.issues },
             { status: 400 }
           );
         }

         const gameData = {
           ...gameValidation.data,
           image: gameValidation.data.image || "",
           likes_count: gameValidation.data.likes_count ?? 0,
         };

         await retry(() => enqueue("neon", "games", gameData), 3, 500);
         return { success: true, message: "Game added to queue", data: gameData };
       }

       if (type === "like") {
         const likeValidation = likesSchema.safeParse(data);
         if (!likeValidation.success) {
           return NextResponse.json(
             { error: "Invalid like data", details: likeValidation.error.issues },
             { status: 400 }
           );
         }

         const likeData = likeValidation.data;
         await retry(() => redis.incrby(`likes:${likeData.id}`, likeData.likesDelta), 3, 500);
         await retry(() => enqueue("neon", "likes", likeData), 3, 500);
         return { success: true, message: "Like registered", data: likeData };
       }

       return { success: false, error: "Invalid type. Use \"game\" or \"like\"" };
     });

     return NextResponse.json({ ...result, idempotencyKey, cached });
   }, "push");
}
