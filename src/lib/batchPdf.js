import PDFDocument from "pdfkit";
import crypto from "crypto";
import { ROLE_LABELS } from "@/constants/roles";
import { decryptSignature } from "@/lib/signatureCrypto";

const money = (v) => `N${Number(v || 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const safe = (v) => v === undefined || v === null || v === "" ? "-" : String(v);

export function generateBatchPDF(batch, encryptedSignature) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, info: { Title: `Procurement Batch ${batch.batchNumber}`, Author: batch.signedBy?.fullName || batch.createdBy?.fullName || "Kaduna State University" } });
      const chunks = [];
      doc.on("data", c => chunks.push(c));
      doc.on("error", reject);
      doc.on("end", () => { const buffer = Buffer.concat(chunks); resolve({ buffer, hash: crypto.createHash("sha256").update(buffer).digest("hex") }); });

      doc.fontSize(18).text("Kaduna State University", { align: "center" });
      doc.fontSize(11).text("Digital Procurement Requisition System", { align: "center" });
      doc.moveDown(.4); doc.fontSize(14).text("PROCUREMENT SUBMISSION BATCH", { align: "center" }); doc.moveDown();
      doc.fontSize(10);
      doc.text(`Batch Number: ${safe(batch.batchNumber)}`);
      doc.text(`Created: ${batch.createdAt ? new Date(batch.createdAt).toLocaleString("en-NG") : "-"}`);
      doc.text(`Submitted: ${batch.submittedAt ? new Date(batch.submittedAt).toLocaleString("en-NG") : "-"}`);
      doc.text(`Created By: ${safe(batch.createdBy?.fullName)}`);
      doc.text(`Requisitions: ${(batch.requisitions || []).length}`);
      doc.text(`Total Estimated Value: ${money(batch.totalEstimatedCost)}`);
      doc.moveDown();

      doc.fontSize(12).text("Approved Requisitions", { underline: true }); doc.fontSize(9);
      (batch.requisitions || []).forEach((r,i) => doc.text(`${i+1}. ${safe(r.requisitionNumber)} | ${safe(r.department)} | ${safe(r.category)} | ${money(r.estimatedCost)}`));

      (batch.requisitions || []).forEach((r,i) => {
        doc.addPage(); doc.fontSize(13).text(`Requisition ${safe(r.requisitionNumber)}`, { underline: true }); doc.moveDown(.4); doc.fontSize(10);
        doc.text(`Department: ${safe(r.department)}`); doc.text(`Category: ${safe(r.category)}`); doc.text(`Urgency: ${safe(r.urgency)}`);
        doc.text(`Final Approval: ${r.finalApprovalAt ? new Date(r.finalApprovalAt).toLocaleString("en-NG") : "-"}`); doc.moveDown(.4);
        doc.text("Purpose / Justification:"); doc.text(safe(r.purpose), { indent: 10 }); doc.moveDown(.5);
        doc.fontSize(11).text("Requested Items", { underline: true }); doc.fontSize(9);
        (r.items || []).forEach((it,j) => doc.text(`${j+1}. ${safe(it.name)} — Qty: ${safe(it.quantity)} × ${money(it.unitCost)} = ${money(it.totalCost)}`));
        doc.moveDown(.4); doc.fontSize(10).text(`Estimated Total: ${money(r.estimatedCost)}`, { align: "right" });
        doc.moveDown(.6); doc.fontSize(11).text("Approval Chain", { underline: true }); doc.fontSize(9);
        (r.approvalChain || []).forEach((step,j) => doc.text(`${j+1}. ${ROLE_LABELS[step.role] || safe(step.role)}${step.approver?.fullName ? ` — ${step.approver.fullName}` : ""}`));
      });

      doc.addPage(); doc.fontSize(13).text("VC Authorization", { underline: true }); doc.moveDown(); doc.fontSize(10);
      doc.text("I hereby authorize the submission of the approved requisitions contained in this batch to the Procurement Unit for further procurement processing."); doc.moveDown(1.2);
      if (!encryptedSignature) throw new Error("VC digital signature is not configured.");
      const data = decryptSignature(encryptedSignature); const m = data.match(/^data:image\/(png|jpe?g);base64,(.+)$/i);
      if (!m) throw new Error("VC signature must be a PNG or JPEG image.");
      doc.image(Buffer.from(m[2], "base64"), { fit: [180, 80] }); doc.moveDown(.4);
      doc.fontSize(10).text(`Name: ${safe(batch.signedBy?.fullName)}`);
      doc.text(`Role: ${ROLE_LABELS[batch.signedBy?.role] || "Vice Chancellor"}`);
      doc.text(`Signing Date: ${batch.signedAt ? new Date(batch.signedAt).toLocaleString("en-NG") : "-"}`);
      doc.text(`Batch Number: ${safe(batch.batchNumber)}`);
      doc.moveDown(1); doc.fontSize(8).text("This document is integrity-protected by a SHA-256 hash recorded by the system.");
      doc.end();
    } catch (e) { reject(e); }
  });
}
