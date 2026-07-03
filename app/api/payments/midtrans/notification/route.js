import { NextResponse } from "next/server";
import "@/lib/order";
import {
  normalizePaymentAttemptError,
  paymentAttemptService,
} from "@/lib/payment-attempt";

function buildPaymentAttemptErrorResponse(error) {
  const normalized = normalizePaymentAttemptError(error);
  return NextResponse.json(
    { error: normalized.message },
    { status: normalized.statusCode || 500 },
  );
}

export async function POST(request) {
  console.log("========== MIDTRANS WEBHOOK ==========");

  const payload = await request.json();

  console.log("Payload:", payload);

  try {
    const attempt =
      await paymentAttemptService.handleMidtransNotification(payload);

    console.log("Webhook Result:", attempt);

    return NextResponse.json(attempt);
  } catch (error) {
    console.error(error);

    return buildPaymentAttemptErrorResponse(error);
  }
}

// export async function POST(request) {
//   const payload = await request.json().catch(() => ({}));

//   try {
//     const attempt =
//       await paymentAttemptService.handleMidtransNotification(payload);
//     return NextResponse.json(attempt);
//   } catch (error) {
//     return buildPaymentAttemptErrorResponse(error);
//   }
// }
