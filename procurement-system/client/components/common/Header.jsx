// client/components/common/Header.jsx
'use client';

import { useState, useEffect } from 'react';
import { FaBell, FaUser, FaBars } from 'react-icons/fa';
import { useAuth } from '@/context/AuthContext';
import styles from './Header.module.css';

export default function Header({ user }) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
      sidebar.classList.toggle('open');
    }
  };

  return (
    <header className={styles.header}>
      <div className={styles.leftSection}>
        <button className={styles.menuButton} onClick={toggleMobileMenu}>
          <FaBars />
        </button>
        <div className={styles.dateTime}>
          <span className={styles.date}>
            {currentTime.toLocaleDateString('en-NG', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </span>
          <span className={styles.time}>
            {currentTime.toLocaleTimeString('en-NG')}
          </span>
        </div>
      </div>

      <div className={styles.rightSection}>
        <div className={styles.notificationContainer}>
          <button 
            className={styles.notificationButton}
            onClick={() => setShowNotifications(!showNotifications)}
          >
            <FaBell />
            {notifications.filter(n => !n.read).length > 0 && (
              <span className={styles.notificationBadge}>
                {notifications.filter(n => !n.read).length}
              </span>
            )}
          </button>
          
          {showNotifications && (
            <div className={styles.notificationDropdown}>
              <div className={styles.dropdownHeader}>
                <h3>Notifications</h3>
                <button className={styles.markAllRead}>Mark all as read</button>
              </div>
              <div className={styles.notificationList}>
                {notifications.length === 0 ? (
                  <p className={styles.noNotifications}>No new notifications</p>
                ) : (
                  notifications.map(notification => (
                    <div key={notification.id} className={styles.notificationItem}>
                      <div className={styles.notificationContent}>
                        <p className={styles.notificationTitle}>{notification.title}</p>
                        <p className={styles.notificationMessage}>{notification.message}</p>
                        <span className={styles.notificationTime}>
                          {new Date(notification.createdAt).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className={styles.userInfo}>
          <div className={styles.userAvatar}>
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </div>
          <div className={styles.userDetails}>
            <p className={styles.userName}>{user?.firstName} {user?.lastName}</p>
            <p className={styles.userRole}>{user?.role}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
