'use client';

import { useRouter } from 'next/navigation';
import { Sun, Moon, LogOut, User } from 'lucide-react';
import { useTheme } from './ThemeProvider';
import styles from './Header.module.css';
import { useEffect, useState } from 'react';

export default function Header() {
  const { theme, toggle: toggleTheme } = useTheme();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) setUser(JSON.parse(savedUser));
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    localStorage.removeItem('user');
    router.push('/login');
  };

  return (
    <header className={`${styles.header} glass`}>
      <div className={styles.inner}>
        <div className={styles.left}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mark.svg" alt="MR" className={styles.logo} />
          <div className={styles.brand}>
            <span className={styles.brandName}>Montacargas y Servicios</span>
            <span className={styles.brandSub}>Refacciones para montacargas</span>
          </div>
        </div>

        <div className={styles.right}>
          <button className={styles.themeBtn} onClick={toggleTheme} title="Cambiar tema">
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>

          <div className={styles.userSection}>
            <div className={styles.userInfo}>
              <span className={styles.userName}>{user?.nombre || 'Usuario'}</span>
              <button onClick={handleLogout} className={styles.logoutBtn}>
                <LogOut size={14} />
                <span>Cerrar Sesión</span>
              </button>
            </div>
            <div className={styles.avatar}>
              <User size={20} />
            </div>
          </div>
        </div>
      </div>
      <div className="accentBar" />
    </header>
  );
}
