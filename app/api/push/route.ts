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
   console.log('[POST /api/push] === REQUEST RECEIVED ===');
   const { error } = await validateJWTMiddleware(request);
   if (error) {
     console.log('[POST /api/push] JWT validation FAILED');
     return error;
   }
   console.log('[POST /api/push] JWT validation OK');

   try {
     await rateLimitMiddleware(request);
     console.log('[POST /api/push] Rate limit OK');
   } catch {
     console.log('[POST /api/push] Rate limit EXCEEDED');
     return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
   }

   return tryApiRoute(async () => {
     console.log('[POST /api/push] Entering tryApiRoute callback');
     const body = await request.json();
     console.log('[POST /api/push] Body parsed:', JSON.stringify(body));

     const validationResult = pushRequestSchema.safeParse(body);
     console.log('[POST /api/push] pushRequestSchema validation:', validationResult.success);
     if (!validationResult.success) {
       console.log('[POST /api/push] pushRequestSchema FAILED:', validationResult.error.issues);
       return NextResponse.json(
         { error: "Invalid request body", details: validationResult.error.issues },
         { status: 400 }
       );
     }

     const { idempotencyKey, type, data } = validationResult.data;
     console.log('[POST /api/push] parsed data:', { idempotencyKey, type, data });

     console.log('[POST /api/push] calling withIdempotency...');
     const { result, cached } = await withIdempotency(idempotencyKey, async () => {
       console.log('[POST /api/push] INSIDE withIdempotency callback, type:', type);
       if (type === "game") {
         console.log('[POST /api/push] type === game');
         const gameValidation = pushGameDataSchema.safeParse(data);
         if (!gameValidation.success) {
           console.log('[POST /api/push] pushGameDataSchema FAILED:', gameValidation.error.issues);
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

         console.log('[POST /api/push] enqueuing game...');
         await retry(() => enqueue("neon", "games", gameData), 3, 500);
         console.log('[POST /api/push] game enqueued OK');
         return { success: true, message: "Game added to queue", data: gameData };
       }

       if (type === "like") {
         console.log('[POST /api/push] type === like');
         const likeValidation = likesSchema.safeParse(data);
         console.log('[POST /api/push] likesSchema validation:', likeValidation.success);
         if (!likeValidation.success) {
           console.log('[POST /api/push] likesSchema FAILED:', likeValidation.error.issues);
           return NextResponse.json(
             { error: "Invalid like data", details: likeValidation.error.issues },
             { status: 400 }
           );
         }

         const likeData = likeValidation.data;
         console.log('[POST /api/push] about to incrby:', `likes:${likeData.id}`, likeData.likesDelta);
         await retry(() => redis.incrby(`likes:${likeData.id}`, likeData.likesDelta), 3, 500);
         console.log('[POST /api/push] incrby OK');
         console.log('[POST /api/push] about to enqueue...');
         await retry(() => enqueue("neon", "likes", likeData), 3, 500);
         console.log('[POST /api/push] like enqueued OK');
         return { success: true, message: "Like registered", data: likeData };
       }

       console.log('[POST /api/push] UNKNOWN type:', type);
       return { success: false, error: "Invalid type. Use \"game\" or \"like\"" };
     });

     console.log('[POST /api/push] withIdempotency returned:', { result, cached });
     return NextResponse.json({ ...result, idempotencyKey, cached });
   }, "push");
}
