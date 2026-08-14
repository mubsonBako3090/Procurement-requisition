"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import InputField from "@/components/forms/InputField";
import Button from "@/components/ui/Button";
import { ROLE_LABELS } from "@/constants/roles";
import { getCollegeById, getFaculty } from "@/constants/colleges";
import styles from "./page.module.css";

function SignaturePad({ value, onChange }) {
  const [canvas, setCanvas] = useState(null);
  const [drawing, setDrawing] = useState(false);

  useEffect(() => {
    const element = document.getElementById("vc-signature-canvas");
    if (!element) return;
    setCanvas(element);
    const ctx = element.getContext("2d");
    ctx.clearRect(0, 0, element.width, element.height);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111827";
  }, []);

  function point(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  function start(event) {
    if (!canvas) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const ctx = canvas.getContext("2d");
    const p = point(event);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    setDrawing(true);
  }

  function move(event) {
    if (!drawing || !canvas) return;
    const ctx = canvas.getContext("2d");
    const p = point(event);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }

  function end() {
    if (!drawing || !canvas) return;
    setDrawing(false);
    onChange(canvas.toDataURL("image/png"));
  }

  function clear() {
    if (!canvas) return;
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    onChange("");
  }

  return (
    <div>
      <div className={styles.canvasHeader}>
        <span>Draw your signature</span>
        <button type="button" className={styles.clearSignature} onClick={clear}>Clear</button>
      </div>
      <canvas
        id="vc-signature-canvas"
        width="760"
        height="220"
        className={styles.signatureCanvas}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        aria-label="VC digital signature drawing area"
      />
      {!value && <p className={styles.canvasHelp}>Use your finger, mouse, or stylus to sign inside the box.</p>}
    </div>
  );
}

export default function SettingsPage() {
  const [user, setUser] = useState(null);
  const [fullName, setFullName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [savingPassword, setSavingPassword] = useState(false);

  const [signature, setSignature] = useState("");
  const [hasSignature, setHasSignature] = useState(false);
  const [signatureVersion, setSignatureVersion] = useState(0);
  const [signaturePassword, setSignaturePassword] = useState("");
  const [savingSignature, setSavingSignature] = useState(false);

  useEffect(() => {
    axios
      .get("/api/users/me")
      .then(async ({ data }) => {
        setUser(data.user);
        setFullName(data.user.fullName);
        if (data.user.role === "vc") {
          try {
            const signatureResponse = await axios.get("/api/users/me/signature");
            setHasSignature(Boolean(signatureResponse.data.hasSignature));
            setSignatureVersion(signatureResponse.data.signatureVersion || 0);
          } catch (signatureError) {
            // Signature settings are optional for non-signature profile usage.
          }
        }
      })
      .catch((err) => toast.error(err.response?.data?.message || "Failed to load profile."));
  }, []);

  async function handleProfileSave(e) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const { data } = await axios.patch("/api/users/me", { fullName });
      setUser(data.user);
      toast.success("Profile updated.");
    } catch (err) {
      toast.error(err.response?.data?.message || "Update failed.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handlePasswordSave(e) {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("New passwords do not match.");
      return;
    }
    setSavingPassword(true);
    try {
      await axios.post("/api/auth/change-password", {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      toast.success("Password updated.");
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      toast.error(err.response?.data?.message || "Password change failed.");
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleSignatureSave(e) {
    e.preventDefault();
    if (!signature) {
      toast.error("Draw your signature before saving.");
      return;
    }
    if (!signaturePassword) {
      toast.error("Enter your current password to save the signature.");
      return;
    }
    setSavingSignature(true);
    try {
      const { data } = await axios.post("/api/users/me/signature", {
        signature,
        currentPassword: signaturePassword,
      });
      setHasSignature(true);
      setSignatureVersion(data.signatureVersion || signatureVersion + 1);
      setSignature("");
      setSignaturePassword("");
      toast.success("Digital signature saved securely.");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save digital signature.");
    } finally {
      setSavingSignature(false);
    }
  }

  if (!user) return <p>Loading…</p>;

  const college = getCollegeById(user.collegeId);
  const faculty = getFaculty(user.collegeId, user.facultyId);

  return (
    <div className={styles.wrapper}>
      <h1 className={styles.heading}>Settings</h1>

      <section className={styles.section}>
        <h4 className={styles.sectionTitle}>Profile</h4>
        <form onSubmit={handleProfileSave} className={styles.form}>
          <InputField id="fullName" label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          <InputField id="email" label="Email address" value={user.email} disabled />
          <InputField id="role" label="Role" value={ROLE_LABELS[user.role] || user.role} disabled />
          <InputField id="college" label="College" value={college?.name || "-"} disabled />
          <InputField id="faculty" label="Faculty" value={faculty?.name || "-"} disabled />
          <InputField id="department" label="Department" value={user.department} disabled />
          <Button type="submit" loading={savingProfile}>
            Save Profile
          </Button>
        </form>
      </section>

      <section className={styles.section}>
        <h4 className={styles.sectionTitle}>Change Password</h4>
        <form onSubmit={handlePasswordSave} className={styles.form}>
          <InputField
            id="currentPassword"
            label="Current password"
            type="password"
            required
            value={passwordForm.currentPassword}
            onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
          />
          <InputField
            id="newPassword"
            label="New password"
            type="password"
            required
            minLength={8}
            value={passwordForm.newPassword}
            onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
          />
          <InputField
            id="confirmPassword"
            label="Confirm new password"
            type="password"
            required
            minLength={8}
            value={passwordForm.confirmPassword}
            onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
          />
          <Button type="submit" loading={savingPassword}>
            Update Password
          </Button>
        </form>
      </section>

      {user.role === "vc" && (
        <section className={styles.section}>
          <h4 className={styles.sectionTitle}>VC Digital Signature</h4>
          <p className={styles.signatureHint}>Your signature is encrypted before it is stored. You must re-enter your current password whenever you create or replace it.</p>
          <form onSubmit={handleSignatureSave} className={styles.form}>
            <div className={styles.signatureCanvasWrap}>
              <SignaturePad value={signature} onChange={setSignature} />
            </div>
            <div className={styles.signatureMeta}>
              <span>{hasSignature ? `Signature configured (version ${signatureVersion}). Drawing a new one will replace it.` : "No digital signature configured yet."}</span>
            </div>
            <InputField
              id="signaturePassword"
              label="Current password"
              type="password"
              required
              value={signaturePassword}
              onChange={(e) => setSignaturePassword(e.target.value)}
              autoComplete="current-password"
            />
            <Button type="submit" loading={savingSignature}>Save Digital Signature</Button>
          </form>
        </section>
      )}

      <section className={styles.section}>
        <h4 className={styles.sectionTitle}>System Info</h4>
        <dl className={styles.infoDl}>
          <dt>Application</dt>
          <dd>KSU Procurement Requisition System</dd>
          <dt>Institution</dt>
          <dd>Kaduna State University</dd>
        </dl>
      </section>
    </div>
  );
}
