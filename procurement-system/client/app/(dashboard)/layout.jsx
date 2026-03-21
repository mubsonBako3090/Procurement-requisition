// client/app/(dashboard)/layout.jsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Sidebar from '@/components/common/Sidebar';
import Header from '@/components/common/Header';
import { Toaster } from 'react-hot-toast';
import styles from './dashboard.module.css';

export default function DashboardLayout({ children }) {
  const { user, isAuthenticated, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [loading, isAuthenticated, router]);

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className={styles.dashboard}>
      <Sidebar user={user} />
      <div className={styles.mainContent}>
        <Header user={user} />
        <main className={styles.content}>
          {children}
        </main>
      </div>
      <Toaster position="top-right" />
    </div>
  );
}
