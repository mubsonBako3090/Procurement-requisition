import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { verifyToken } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import {
  createProcurementBatch,
  listProcurementBatches,
} from "@/services/procurementBatchService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getAuth() {
  const token = cookies().get("token")?.value;
  return token ? verifyToken(token) : null;
}

export async function GET() {
  const auth = getAuth();

  if (!auth) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();
    const batches = await listProcurementBatches({ actor: auth });
    return NextResponse.json({ batches });
  } catch (error) {
    console.error("Procurement batch list error:", error);
    return NextResponse.json(
      { message: error.message || "Failed to load procurement batches." },
      { status: 403 }
    );
  }
}

export async function POST(request) {
  const auth = getAuth();

  if (!auth) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    await connectDB();

    const batch = await createProcurementBatch({
      requisitionIds: body?.requisitionIds,
      actor: auth,
    });

    return NextResponse.json({ batch }, { status: 201 });
  } catch (error) {
    console.error("Procurement batch creation error:", error);
    return NextResponse.json(
      { message: error.message || "Failed to create procurement batch." },
      { status: 400 }
    );
  }
}
