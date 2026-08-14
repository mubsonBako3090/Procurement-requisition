"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import axios from "axios";
import toast from "react-hot-toast";
import Button from "@/components/ui/Button";
import { formatNaira } from "@/utils/formatNaira";
import { formatDate, formatDateTime } from "@/utils/formatDate";
import { ROLES } from "@/constants/roles";
import styles from "./page.module.css";

export default function ProcurementBatchDetailsPage() {
  const { id } = useParams();
  const [user, setUser] = useState(null);
  const [batch, setBatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [password, setPassword] = useState("");
  const [showSign, setShowSign] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [me, response] = await Promise.all([
        axios.get("/api/users/me"),
        axios.get(`/api/procurement-batches/${id}`),
      ]);
      setUser(me.data.user);
      setBatch(response.data.batch);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load procurement batch.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { if (id) load(); }, [id, load]);

  async function signAndSubmit(e) {
    e.preventDefault();
    if (!password) return toast.error("Enter your current password to sign.");
    setSigning(true);
    try {
      const { data } = await axios.post(`/api/procurement-batches/${id}/sign`, { currentPassword: password });
      toast.success(data.message || "Batch signed and submitted to Procurement.");
      setPassword("");
      setShowSign(false);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to sign procurement batch.");
    } finally { setSigning(false); }
  }

  async function cancelBatch() {
    if (!window.confirm("Cancel this draft batch? Its requisitions will be released for future batching.")) return;
    setCancelling(true);
    try {
      await axios.delete(`/api/procurement-batches/${id}`);
      toast.success("Draft batch cancelled.");
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to cancel batch.");
    } finally { setCancelling(false); }
  }

  async function openPdf() {
    setPdfLoading(true);
    try {
      const { data } = await axios.get(`/api/procurement-batches/${id}/pdf`);
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err.response?.data?.message || "Unable to open the signed PDF.");
    } finally { setPdfLoading(false); }
  }

  if (loading) return <p className={styles.hint}>Loading procurement batch…</p>;
  if (!batch) return <p className={styles.hint}>The procurement batch could not be loaded.</p>;

  const isVC = user?.role === ROLES.VC;
  const canManage = isVC && batch.status === "draft" && String(batch.createdBy?._id || batch.createdBy) === String(user?._id || user?.id || "");
  const isSubmitted = batch.status === "submitted";

  return (
    <div className={styles.wrapper}>
      <div className={styles.topbar}>
        <div>
          <Link href="/procurement-batches" className={styles.back}><i className="bi bi-arrow-left" /> Procurement Batches</Link>
          <h1 className={styles.heading}>{batch.batchNumber}</h1>
          <p className={styles.subheading}>Consolidated procurement submission</p>
        </div>
        <span className={`${styles.status} ${styles[`status_${batch.status}`]}`}>{batch.status}</span>
      </div>

      <section className={styles.summaryGrid}>
        <div className={styles.stat}><span>Requisitions</span><strong>{batch.requisitions?.length || 0}</strong></div>
        <div className={styles.stat}><span>Total estimated value</span><strong>{formatNaira(batch.totalEstimatedCost)}</strong></div>
        <div className={styles.stat}><span>Created</span><strong>{formatDate(batch.createdAt)}</strong></div>
        <div className={styles.stat}><span>Submitted</span><strong>{batch.submittedAt ? formatDate(batch.submittedAt) : "Not submitted"}</strong></div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}><h2>Included requisitions</h2></div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Requisition</th><th>Department</th><th>Category</th><th>Purpose</th><th>Estimated Cost</th><th>Approval</th></tr></thead>
            <tbody>
              {(batch.requisitions || []).map((r) => (
                <tr key={r._id}>
                  <td className="mono">{r.requisitionNumber}</td>
                  <td>{r.department || "-"}</td>
                  <td>{r.category || "-"}</td>
                  <td className={styles.purpose}>{r.purpose || "-"}</td>
                  <td className="mono">{formatNaira(r.estimatedCost)}</td>
                  <td>{formatDate(r.finalApprovalAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {isSubmitted && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}><h2>Authorization</h2></div>
          <div className={styles.authorization}>
            <div><span>Signed by</span><strong>{batch.signedBy?.fullName || "Vice-Chancellor"}</strong></div>
            <div><span>Signed at</span><strong>{formatDateTime(batch.signedAt)}</strong></div>
            <div><span>Document hash</span><code>{batch.documentHash || "-"}</code></div>
          </div>
        </section>
      )}

      {canManage && (
        <section className={styles.actionSection}>
          {!showSign ? (
            <div className={styles.actionRow}>
              <Button variant="danger" onClick={cancelBatch} loading={cancelling}>Cancel Draft</Button>
              <Button onClick={() => setShowSign(true)}><i className="bi bi-pen" /> Sign &amp; Submit to Procurement</Button>
            </div>
          ) : (
            <form onSubmit={signAndSubmit} className={styles.signBox}>
              <h2>Confirm digital signature</h2>
              <p>You are authorizing <strong>{batch.batchNumber}</strong>, containing {batch.requisitions?.length || 0} approved requisitions worth <strong>{formatNaira(batch.totalEstimatedCost)}</strong>, for submission to the Procurement Unit.</p>
              <label className={styles.label} htmlFor="signPassword">Current password</label>
              <input id="signPassword" className={styles.input} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
              <div className={styles.actionRow}>
                <Button type="button" variant="ghost" onClick={() => { setShowSign(false); setPassword(""); }}>Cancel</Button>
                <Button type="submit" loading={signing}><i className="bi bi-shield-check" /> Confirm &amp; Sign</Button>
              </div>
            </form>
          )}
        </section>
      )}

      {isSubmitted && (
        <section className={styles.actionSection}>
          <Button onClick={openPdf} loading={pdfLoading}><i className="bi bi-file-earmark-pdf" /> View Signed PDF</Button>
        </section>
      )}
    </div>
  );
}
