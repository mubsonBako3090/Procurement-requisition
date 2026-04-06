// client/app/(auth)/login/page.jsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';
import styles from './login.module.css';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const result = await login(email, password);
    if (result.success) {
      // Redirect based on role
      const role = result.user.role;
      if (role === 'staff') router.push('/staff/dashboard');
      else if (role === 'hod') router.push('/hod/dashboard');
      else if (role === 'procurement') router.push('/procurement/dashboard');
      else if (role === 'finance') router.push('/finance/dashboard');
      else if (role === 'admin') router.push('/admin/dashboard');
      else router.push('/dashboard');
    }
    setLoading(false);
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1>Procurement System</h1>
          <p>Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="staff@university.edu.ng"
              disabled={loading}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter your password"
              disabled={loading}
            />
          </div>

          <div className={styles.options}>
            <label className={styles.checkbox}>
              <input type="checkbox" /> Remember me
            </label>
            <Link href="/forgot-password" className={styles.forgotLink}>
              Forgot Password?
            </Link>
          </div>

          <button
            type="submit"
            className={styles.submitButton}
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className={styles.footer}>
          <p>
            Don't have an account?{' '}
            <Link href="/register">Contact Administrator</Link>
          </p>
        </div>
      </div>
    </div>
  );
  }
