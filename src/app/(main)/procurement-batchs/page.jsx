"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import axios from "axios";
import toast from "react-hot-toast";
import Button from "@/components/ui/Button";
import { formatNaira } from "@/utils/formatNaira";
import { formatDate } from "@/utils/formatDate";
import { ROLES } from "@/constants/roles";
import { REQUISITION_STATUS } from "@/constants/requisitionOptions";
import styles from "./page.module.css";

export default function ProcurementBatchesPage() {
  const [user, setUser] = useState(null);
  const [batches, setBatches] = useState([]);
  const [eligible, setEligible] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const isVC = user?.role === ROLES.VC;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [me, batchResponse] = await Promise.all([
        axios.get("/api/users/me"),
        axios.get("/api/procurement-batches"),
      ]);
      setUser(me.data.user);
      setBatches(batchResponse.data.batches || []);

      if (me.data.user?.role === ROLES.VC) {
        const { data } = await axios.get("/api/requisitions", {
          params: { status: REQUISITION_STATUS.APPROVED },
        });
        setEligible(
          (data.requisitions || []).filter(
            (r) => r.status === REQUISITION_STATUS.APPROVED && r.procurementStatus === "ready" && !r.procurementBatch
          )
        );
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load procurement batches.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const selectedTotal = useMemo(
    () => eligible.filter((r) => selected.includes(r._id)).reduce((sum, r) => sum + Number(r.estimatedCost || 0), 0),
    [eligible, selected]
  );

  function toggle(id) {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function selectAll() {
    setSelected(selected.length === eligible.length ? [] : eligible.map((r) => r._id));
  }

  async function createBatch() {
    if (!selected.length) return toast.error("Select at least one approved requisition.");
    setCreating(true);
    try {
      const { data } = await axios.post("/api/procurement-batches", { requisitionIds: selected });
      toast.success(`Batch ${data.batch.batchNumber} created.`);
      window.location.href = `/procurement-batches/${data.batch._id}`;
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create procurement batch.");
    } finally {
      setCreating(false);
    }
  }

  if (loading) return <p className={styles.hint}>Loading procurement batches…</p>;

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.heading}>Procurement Batches</h1>
          <p className={styles.subheading}>
            Group fully approved requisitions into an official submission to the Procurement Unit.
          </p>
        </div>
      </div>

      {isVC && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle}>Approved requisitions ready for Procurement</h2>
              <p className={styles.muted}>Only requisitions that have completed VC approval and are not already batched can be selected.</p>
            </div>
            <Button variant="secondary" onClick={selectAll} disabled={!eligible.length}>
              {selected.length === eligible.length && eligible.length ? "Clear All" : "Select All"}
            </Button>
          </div>

          {eligible.length === 0 ? (
            <p className={styles.hint}>There are no approved requisitions currently ready for batching.</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.checkboxCell}></th>
                    <th>Requisition</th>
                    <th>Department</th>
                    <th>Category</th>
                    <th>Estimated Cost</th>
                    <th>Approved</th>
                  </tr>
                </thead>
                <tbody>
                  {eligible.map((r) => (
                    <tr key={r._id}>
                      <td className={styles.checkboxCell}>
                        <input type="checkbox" checked={selected.includes(r._id)} onChange={() => toggle(r._id)} aria-label={`Select ${r.requisitionNumber}`} />
                      </td>
                      <td className="mono">{r.requisitionNumber}</td>
                      <td>{r.department || "-"}</td>
                      <td>{r.category || "-"}</td>
                      <td className="mono">{formatNaira(r.estimatedCost)}</td>
                      <td>{formatDate(r.finalApprovalAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className={styles.selectionBar}>
            <div>
              <strong>{selected.length}</strong> requisition{selected.length === 1 ? "" : "s"} selected
              <span className={styles.total}>Total: {formatNaira(selectedTotal)}</span>
            </div>
            <Button onClick={createBatch} loading={creating} disabled={!selected.length}>
              <i className="bi bi-collection" /> Create Procurement Batch
            </Button>
          </div>
        </section>
      )}

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Batch history</h2>
          <span className={styles.count}>{batches.length}</span>
        </div>
        {batches.length === 0 ? (
          <p className={styles.hint}>No procurement batches found.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr><th>Batch</th><th>Requisitions</th><th>Total</th><th>Status</th><th>Date</th><th></th></tr>
              </thead>
              <tbody>
                {batches.map((batch) => (
                  <tr key={batch._id}>
                    <td className="mono">{batch.batchNumber}</td>
                    <td>{batch.requisitions?.length || 0}</td>
                    <td className="mono">{formatNaira(batch.totalEstimatedCost)}</td>
                    <td><span className={`${styles.status} ${styles[`status_${batch.status}`]}`}>{batch.status}</span></td>
                    <td>{formatDate(batch.submittedAt || batch.createdAt)}</td>
                    <td><Link className={styles.viewLink} href={`/procurement-batches/${batch._id}`}>View</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
