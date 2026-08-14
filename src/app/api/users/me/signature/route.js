import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { verifyToken, verifyPassword } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import AuditLog from "@/models/AuditLog";
import { encryptSignature } from "@/lib/signatureCrypto";
import { ROLES } from "@/constants/roles";

function getAuth() {
  const token = cookies().get("token")?.value;
  return token ? verifyToken(token) : null;
}

function unauthorized() {
  return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
}

export async function GET() {
  const auth = getAuth();
  if (!auth) return unauthorized();
  if (auth.role !== ROLES.VC) {
    return NextResponse.json({ message: "Only the Vice-Chancellor can manage a digital signature." }, { status: 403 });
  }

  await connectDB();
  const user = await User.findById(auth.sub).select("signatureCiphertext signatureUpdatedAt signatureVersion").lean();

  if (!user) return unauthorized();

  return NextResponse.json({
    hasSignature: Boolean(user.signatureCiphertext),
    signatureUpdatedAt: user.signatureUpdatedAt || null,
    signatureVersion: user.signatureVersion || 0,
  });
}

export async function POST(request) {
  const auth = getAuth();
  if (!auth) return unauthorized();
  if (auth.role !== ROLES.VC) {
    return NextResponse.json({ message: "Only the Vice-Chancellor can manage a digital signature." }, { status: 403 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid request body." }, { status: 400 });
  }

  const { currentPassword, signature } = body || {};
  if (!currentPassword || typeof signature !== "string") {
    return NextResponse.json({ message: "Current password and signature are required." }, { status: 400 });
  }

  // Keep the payload bounded. A drawn PNG should not be megabytes of data.
  if (signature.length > 500_000) {
    return NextResponse.json({ message: "Signature image is too large." }, { status: 413 });
  }

  if (!/^data:image\/(png|webp);base64,[A-Za-z0-9+/=]+$/.test(signature)) {
    return NextResponse.json({ message: "Signature must be a PNG or WebP data image." }, { status: 400 });
  }

  await connectDB();
  const user = await User.findById(auth.sub).select("+passwordHash signatureVersion");
  if (!user || user.role !== ROLES.VC || user.accountStatus !== "active") {
    return unauthorized();
  }

  const passwordOk = await verifyPassword(currentPassword, user.passwordHash);
  if (!passwordOk) {
    await AuditLog.create({
      actor: user._id,
      action: "vc.signature_update_failed",
      entityType: "User",
      entityId: user._id,
      details: { reason: "invalid_current_password" },
    });
    return NextResponse.json({ message: "Current password is incorrect." }, { status: 401 });
  }

  const encrypted = encryptSignature(signature);
  user.signatureCiphertext = encrypted;
  user.signatureUpdatedAt = new Date();
  user.signatureVersion = (user.signatureVersion || 0) + 1;
  await user.save();

  await AuditLog.create({
    actor: user._id,
    action: "vc.signature_updated",
    entityType: "User",
    entityId: user._id,
    details: { signatureVersion: user.signatureVersion },
  });

  return NextResponse.json({
    message: "Digital signature saved securely.",
    signatureUpdatedAt: user.signatureUpdatedAt,
    signatureVersion: user.signatureVersion,
  });
}

export async function DELETE(request) {
  const auth = getAuth();
  if (!auth) return unauthorized();
  if (auth.role !== ROLES.VC) {
    return NextResponse.json({ message: "Only the Vice-Chancellor can manage a digital signature." }, { status: 403 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid request body." }, { status: 400 });
  }

  const { currentPassword } = body || {};
  if (!currentPassword) {
    return NextResponse.json({ message: "Current password is required." }, { status: 400 });
  }

  await connectDB();
  const user = await User.findById(auth.sub).select("+passwordHash signatureVersion signatureCiphertext");
  if (!user || user.role !== ROLES.VC || user.accountStatus !== "active") return unauthorized();

  const passwordOk = await verifyPassword(currentPassword, user.passwordHash);
  if (!passwordOk) {
    return NextResponse.json({ message: "Current password is incorrect." }, { status: 401 });
  }

  user.signatureCiphertext = undefined;
  user.signatureUpdatedAt = new Date();
  user.signatureVersion = (user.signatureVersion || 0) + 1;
  await user.save();

  await AuditLog.create({
    actor: user._id,
    action: "vc.signature_removed",
    entityType: "User",
    entityId: user._id,
    details: { signatureVersion: user.signatureVersion },
  });

  return NextResponse.json({ message: "Digital signature removed." });
}
