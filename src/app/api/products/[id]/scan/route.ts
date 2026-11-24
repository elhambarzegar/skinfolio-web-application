import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { scanIngredientsFromPhoto } from "@/lib/productLookup/photoScan";
import { scoreConfidence, confidenceBucket } from "@/lib/productLookup/confidence";

const ALLOWED_MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "You need to be logged in." }, { status: 401 });
  }

  const { id } = await params;
  // A photo is of the person's own bottle, so it belongs to their shelf.
  const item = await prisma.shelfItem.findUnique({
    where: { userId_productId: { userId: session.user.id, productId: id } },
  });
  if (!item) {
    return NextResponse.json({ error: "That product isn't on your shelf." }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const imageBase64 = typeof body?.imageBase64 === "string" ? body.imageBase64 : null;
  const mediaType = ALLOWED_MEDIA_TYPES.includes(body?.mediaType) ? body.mediaType : null;

  if (!imageBase64 || !mediaType) {
    return NextResponse.json({ error: "Missing or invalid photo." }, { status: 400 });
  }
  // Rough cap on the decoded image size (~15MB) — keeps requests well under
  // the API's limits without needing to actually decode base64 to check.
  if (imageBase64.length > 20_000_000) {
    return NextResponse.json({ error: "That photo is too large. Try again with a smaller image." }, { status: 400 });
  }

  const result = await scanIngredientsFromPhoto(imageBase64, mediaType);

  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 422 });
  }

  const publishedAt = new Date();
  const breakdown = scoreConfidence({
    authority: "user_verified",
    extraction: "photo_ocr",
    publishedAt,
    precision: "EXACT",
  });

  await prisma.$transaction(async (tx) => {
    const newSource = await tx.productSource.create({
      data: {
        productId: id,
        origin: "USER_PHOTO",
        sourceUrl: null,
        ingredientsInci: result.ingredientsInci,
        rawExtract: result.ingredientsInci,
        publishedAt,
        publishedAtPrecision: "EXACT",
        confidenceScore: breakdown.total,
        confidenceBreakdown: breakdown,
        status: "PENDING",
      },
    });

    // The new photo replaces the person's earlier one; the old one is kept as history.
    if (item.photoSourceId) {
      await tx.shelfItem.update({ where: { id: item.id }, data: { photoSourceId: null } });
      await tx.productSource.update({
        where: { id: item.photoSourceId },
        data: { status: "SUPERSEDED", supersededById: newSource.id },
      });
    }
    await tx.shelfItem.update({ where: { id: item.id }, data: { photoSourceId: newSource.id } });
  });

  return NextResponse.json({
    confidenceScore: breakdown.total,
    bucket: confidenceBucket(breakdown.total),
  });
}
