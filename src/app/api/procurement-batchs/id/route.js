import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import mongoose from "mongoose";

import { verifyToken } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import {
  getProcurementBatch,
  cancelProcurementBatch,
} from "@/services/procurementBatchService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getAuth() {
  const token = cookies().get("token")?.value;
  return token ? verifyToken(token) : null;
}

export async function GET(request, { params }) {
  const auth = getAuth();

  if (!auth) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  if (!mongoose.isValidObjectId(params?.id)) {
    return NextResponse.json(
      { message: "Invalid procurement batch ID." },
      { status: 400 }
    );
  }

  try {
    await connectDB();

    const batch = await getProcurementBatch({
      batchId: params.id,
      actor: auth,
    });

    return NextResponse.json({ batch });
  } catch (error) {
    console.error("Procurement batch detail error:", error);

    const status = error.message === "Procurement batch not found." ? 404 : 403;

    return NextResponse.json(
      { message: error.message || "Failed to load procurement batch." },
      { status }
    );
  }
}

export async function DELETE(request, { params }) {
  const auth = getAuth();

  if (!auth) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  if (!mongoose.isValidObjectId(params?.id)) {
    return NextResponse.json(
      { message: "Invalid procurement batch ID." },
      { status: 400 }
    );
  }

  try {
    await connectDB();

    const batch = await cancelProcurementBatch({
      batchId: params.id,
      actor: auth,
    });

    return NextResponse.json({ batch });
  } catch (error) {
    console.error("Procurement batch cancellation error:", error);

    const status = error.message === "Procurement batch not found." ? 404 : 400;

    return NextResponse.json(
      { message: error.message || "Failed to cancel procurement batch." },
      { status }
    );
  }
}
