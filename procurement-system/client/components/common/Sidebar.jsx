// client/components/common/Sidebar.jsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  FaHome, 
  FaFileAlt, 
  FaCheckCircle, 
  FaShoppingCart, 
  FaUsers, 
  FaChartBar,
  FaBuilding,
  FaMoneyBillWave,
  FaCog,
  FaSignOutAlt
} from 'react-icons/fa';
import { useAuth } from '@/context/AuthContext';
import styles from './Sidebar.module.css';

export default function Sidebar({ user }) {
  const pathname = usePathname();
  const { logout } = useAuth();

  const getMenuItems = () => {
    const role = user?.role;
    const commonItems = [
      { path: '/dashboard', icon: FaHome, label: 'Dashboard' },
    ];

    const roleSpecificItems = {
      staff: [
        { path: '/staff/requisitions', icon: FaFileAlt, label: 'My Requisitions' },
        { path: '/staff/requisitions/new', icon: FaFileAlt, label: 'New Requisition' },
      ],
      hod: [
        { path: '/hod/approvals', icon: FaCheckCircle, label: 'Pending Approvals' },
        { path: '/hod/budget', icon: FaMoneyBillWave, label: 'Budget Monitor' },
        { path: '/hod/reports', icon: FaChartBar, label: 'Department Reports' },
      ],
      procurement: [
        { path: '/procurement/requests', icon: FaShoppingCart, label: 'Requests to Process' },
        { path: '/procurement/vendors', icon: FaUsers, label: 'Vendor Management' },
        { path: '/procurement/tenders', icon: FaFileAlt, label: 'Tender Management' },
      ],
      finance: [
        { path: '/finance/budgets', icon: FaMoneyBillWave, label: 'Budget Management' },
        { path: '/finance/payments', icon: FaCheckCircle, label: 'Payment Processing' },
        { path: '/finance/reports', icon: FaChartBar, label: 'Financial Reports' },
      ],
      admin: [
        { path: '/admin/users', icon: FaUsers, label: 'User Management' },
        { path: '/admin/departments', icon: FaBuilding, label: 'Department Management' },
        { path: '/admin/reports', icon: FaChartBar, label: 'System Reports' },
        { path: '/admin/settings', icon: FaCog, label: 'System Settings' },
      ],
    };

    return [...commonItems, ...(roleSpecificItems[role] || [])];
  };

  const menuItems = getMenuItems();

  return (
    <div className={styles.sidebar}>
      <div className={styles.logo}>
        <h2>Procure<span>System</span></h2>
      </div>

      <div className={styles.userInfo}>
        <div className={styles.avatar}>
          {user?.firstName?.[0]}{user?.lastName?.[0]}
        </div>
        <div className={styles.userDetails}>
          <p className={styles.userName}>{user?.firstName} {user?.lastName}</p>
          <p className={styles.userRole}>{user?.role?.toUpperCase()}</p>
        </div>
      </div>

      <nav className={styles.nav}>
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.path || pathname?.startsWith(item.path + '/');
          return (
            <Link
              key={item.path}
              href={item.path}
              className={`${styles.navLink} ${isActive ? styles.active : ''}`}
            >
              <Icon className={styles.navIcon} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className={styles.footer}>
        <button onClick={logout} className={styles.logoutButton}>
          <FaSignOutAlt className={styles.navIcon} />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
}
