// client/app/(dashboard)/staff/dashboard/page.jsx
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FaFileAlt, FaCheckCircle, FaClock, FaChartLine } from 'react-icons/fa';
import styles from './dashboard.module.css';

export default function StaffDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0
  });
  const [recentRequisitions, setRecentRequisitions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/requisitions/my-requisitions?limit=5`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      
      if (data.success) {
        setRecentRequisitions(data.requisitions || []);
        
        // Calculate stats
        const requisitions = data.requisitions || [];
        setStats({
          total: data.pagination?.total || 0,
          pending: requisitions.filter(r => r.status === 'submitted' || r.status === 'hod_review').length,
          approved: requisitions.filter(r => r.status === 'completed').length,
          rejected: requisitions.filter(r => r.status.includes('rejected')).length
        });
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadgeClass = (status) => {
    const classes = {
      draft: 'badge-secondary',
      submitted: 'badge-info',
      hod_review: 'badge-warning',
      hod_approved: 'badge-primary',
      hod_rejected: 'badge-danger',
      procurement_processing: 'badge-info',
      order_placed: 'badge-primary',
      goods_received: 'badge-success',
      completed: 'badge-success',
      cancelled: 'badge-danger'
    };
    return classes[status] || 'badge-secondary';
  };

  const getStatusText = (status) => {
    const texts = {
      draft: 'Draft',
      submitted: 'Submitted',
      hod_review: 'Under HOD Review',
      hod_approved: 'HOD Approved',
      hod_rejected: 'HOD Rejected',
      procurement_processing: 'Processing',
      order_placed: 'Order Placed',
      goods_received: 'Goods Received',
      completed: 'Completed',
      cancelled: 'Cancelled'
    };
    return texts[status] || status;
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className="loading-spinner"></div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className={styles.dashboard}>
      <div className={styles.welcomeSection}>
        <h1>Welcome back, {user?.firstName}!</h1>
        <p>Your procurement dashboard - Track and manage your requisitions</p>
      </div>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: '#667eea' }}>
            <FaFileAlt />
          </div>
          <div className={styles.statInfo}>
            <h3>{stats.total}</h3>
            <p>Total Requisitions</p>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: '#f59e0b' }}>
            <FaClock />
          </div>
          <div className={styles.statInfo}>
            <h3>{stats.pending}</h3>
            <p>Pending Approval</p>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: '#10b981' }}>
            <FaCheckCircle />
          </div>
          <div className={styles.statInfo}>
            <h3>{stats.approved}</h3>
            <p>Completed</p>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: '#ef4444' }}>
            <FaChartLine />
          </div>
          <div className={styles.statInfo}>
            <h3>{stats.rejected}</h3>
            <p>Rejected</p>
          </div>
        </div>
      </div>

      <div className={styles.quickActions}>
        <h2>Quick Actions</h2>
        <div className={styles.actionButtons}>
          <Link href="/staff/requisitions/new" className={styles.primaryButton}>
            + Create New Requisition
          </Link>
          <Link href="/staff/requisitions" className={styles.secondaryButton}>
            View All Requisitions
          </Link>
        </div>
      </div>

      <div className={styles.recentSection}>
        <h2>Recent Requisitions</h2>
        {recentRequisitions.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No requisitions found. Create your first requisition!</p>
            <Link href="/staff/requisitions/new" className={styles.emptyStateButton}>
              Create Requisition
            </Link>
          </div>
        ) : (
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Requisition No.</th>
                  <th>Title</th>
                  <th>Amount</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {recentRequisitions.map((req) => (
                  <tr key={req._id}>
                    <td className={styles.reqNumber}>{req.requisitionNumber}</td>
                    <td>{req.title}</td>
                    <td>₦{req.totalAmount?.toLocaleString()}</td>
                    <td>{new Date(req.createdAt).toLocaleDateString()}</td>
                    <td>
                      <span className={`${styles.badge} ${styles[getStatusBadgeClass(req.status)]}`}>
                        {getStatusText(req.status)}
                      </span>
                    </td>
                    <td>
                      <Link href={`/staff/requisitions/${req._id}`} className={styles.viewLink}>
                        View Details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
