import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(_request, { params }) {
  const order = await prisma.order.findUnique({
    where: { id: params.id },
  });

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  return NextResponse.json(order);
}
