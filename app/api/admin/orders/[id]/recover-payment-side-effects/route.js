import { NextResponse } from 'next/server';
import { withDevTiming } from '@/lib/dev-timing';
import { requireHqPermission, writeAuditLog } from '@/lib/hq-security';
import { normalizeOrderError, orderService } from '@/lib/order';
import { prisma } from '@/lib/prisma';

function buildOrderErrorResponse(error) {
  const normalized = normalizeOrderError(error);
  return NextResponse.json(
    { error: normalized.message, code: normalized.code },
    { status: normalized.statusCode || 500 },
  );
}

async function findOrderByReference(reference) {
  const normalizedReference = String(reference || '').trim();
  if (!normalizedReference) return null;

  return prisma.order.findFirst({
    where: {
      OR: [
        { id: normalizedReference },
        { orderNumber: normalizedReference },
        { publicOrderNumber: normalizedReference },
      ],
    },
    select: {
      id: true,
      orderNumber: true,
      publicOrderNumber: true,
      paymentAttemptId: true,
      paymentAttempt: {
        select: {
          id: true,
          attemptNumber: true,
          status: true,
        },
      },
    },
  });
}

async function getRecoveryState(orderId) {
  const [salesJournal, cogsJournal, stockMovementCount] = await Promise.all([
    prisma.journalEntry.findFirst({
      where: {
        journalSource: 'Sales',
        journalType: 'System',
        sourceId: orderId,
      },
      select: {
        id: true,
        journalNumber: true,
        totalCredit: true,
      },
    }),
    prisma.journalEntry.findFirst({
      where: {
        journalSource: 'COGS',
        journalType: 'System',
        sourceId: orderId,
      },
      select: {
        id: true,
        journalNumber: true,
        totalDebit: true,
      },
    }),
    prisma.stockMovement.count({
      where: {
        referenceType: 'ORDER',
        referenceId: orderId,
        movementType: 'SALE',
      },
    }),
  ]);

  return {
    hasSalesJournal: Boolean(salesJournal),
    salesJournal,
    hasCogsJournal: Boolean(cogsJournal),
    cogsJournal,
    stockMovementCount,
  };
}

export async function POST(request, { params }) {
  return withDevTiming(request, async () => {
    let authContext;
    try {
      authContext = await requireHqPermission(request, 'finance', 'cash_in');
    } catch (error) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode || 403 });
    }

    try {
      const order = await findOrderByReference(params.id);
      if (!order) {
        return NextResponse.json({ error: 'Order was not found.', code: 'ORDER_NOT_FOUND' }, { status: 404 });
      }
      if (!order.paymentAttemptId || !order.paymentAttempt) {
        return NextResponse.json({ error: 'Order does not have a linked payment attempt.', code: 'ORDER_PAYMENT_ATTEMPT_NOT_FOUND' }, { status: 400 });
      }
      if (order.paymentAttempt.status !== 'PAID') {
        return NextResponse.json({ error: 'Only paid orders can be recovered.', code: 'ORDER_PAYMENT_ATTEMPT_NOT_PAID' }, { status: 409 });
      }

      const before = await getRecoveryState(order.id);
      let recoveredOrder = null;
      let recoveryError = null;

      try {
        recoveredOrder = await orderService.createFromCheckoutSession({
          paymentAttemptId: order.paymentAttemptId,
        });
      } catch (error) {
        recoveryError = error;
      }

      const after = await getRecoveryState(order.id);
      if (recoveryError && !after.hasSalesJournal) {
        throw recoveryError;
      }

      const partialRecovery = Boolean(recoveryError);
      await writeAuditLog({
        user: authContext.user,
        module: 'FINANCE',
        action: partialRecovery ? 'ORDER_PAYMENT_SIDE_EFFECTS_PARTIALLY_RECOVERED' : 'ORDER_PAYMENT_SIDE_EFFECTS_RECOVERED',
        description: partialRecovery
          ? `Recovered sales journal for order ${order.orderNumber}; some downstream side effects still require review.`
          : `Recovered payment side effects for order ${order.orderNumber}.`,
        metadata: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          publicOrderNumber: order.publicOrderNumber,
          paymentAttemptId: order.paymentAttemptId,
          paymentAttemptNumber: order.paymentAttempt.attemptNumber,
          before,
          after,
          recovery: recoveredOrder?.__meta || null,
          warning: recoveryError?.message || '',
          warningCode: recoveryError?.code || '',
        },
      });

      return NextResponse.json({
        success: !partialRecovery,
        partialRecovery,
        warning: recoveryError?.message || '',
        warningCode: recoveryError?.code || '',
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          publicOrderNumber: order.publicOrderNumber,
        },
        paymentAttempt: order.paymentAttempt,
        before,
        after,
        recovery: recoveredOrder?.__meta || null,
      });
    } catch (error) {
      return buildOrderErrorResponse(error);
    }
  });
}
