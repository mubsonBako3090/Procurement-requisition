import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import ProcurementBatch from "@/models/ProcurementBatch";
import AuditLog from "@/models/AuditLog";
import { ROLES } from "@/constants/roles";
import cloudinary from "@/lib/cloudinary";

function auth() { const t = cookies().get("token")?.value; return t ? verifyToken(t) : null; }

export async function GET(request, { params }) {
  const user = auth(); if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (![ROLES.VC, ROLES.PROCUREMENT].includes(user.role)) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  await connectDB();
  const batch = await ProcurementBatch.findById(params.id).select("batchNumber status documentHash documentPublicId documentResourceType").lean();
  if (!batch) return NextResponse.json({ message: "Procurement batch not found." }, { status: 404 });
  if (batch.status !== "submitted") return NextResponse.json({ message: "The batch has not been submitted to Procurement." }, { status: 403 });
  if (!batch.documentPublicId || batch.documentResourceType !== "raw") return NextResponse.json({ message: "Signed PDF is not available." }, { status: 404 });
  const url = cloudinary.url(batch.documentPublicId, { secure: true, resource_type: "raw", type: "authenticated", sign_url: true });
  await AuditLog.create({ actor: user.sub, action: "procurement_batch.pdf_download", entityType: "ProcurementBatch", entityId: batch._id, details: { batchNumber: batch.batchNumber, documentHash: batch.documentHash } });
  return NextResponse.json({ url, documentHash: batch.documentHash });
}
