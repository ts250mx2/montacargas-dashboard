'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, FileText, DollarSign, Users, Truck,
  Package, Tags, Settings, ChevronsLeft, ChevronsRight, Menu, Receipt,
} from 'lucide-react';
import { useSidebar } from './SidebarContext';
import styles from './Sidebar.module.css';

export default function Sidebar() {
  const pathname = usePathname();
  const { collapsed, toggle: toggleSidebar } = useSidebar();

  const menuItems = [
    { name: 'Inicio',        icon: LayoutDashboard, path: '/' },
    { name: 'Facturas',      icon: FileText,        path: '/facturas' },
    { name: 'Cobranza',      icon: DollarSign,      path: '/cobranza' },
    { name: 'Gastos',        icon: Receipt,         path: '/gastos' },
    { name: 'Clientes',      icon: Users,           path: '/clientes' },
    { name: 'Productos',     icon: Package,         path: '/productos' },
    { name: 'Proveedores',   icon: Truck,           path: '/proveedores' },
    { name: 'Catálogos',     icon: Tags,            path: '/catalogos' },
    { name: 'Configuración', icon: Settings,        path: '/configuracion' },
  ];

  const isActivePath = (path: string) =>
    path === '/' ? pathname === '/' : pathname.startsWith(path);

  return (
    <>
      {/* Backdrop solo en móvil cuando el menú está abierto */}
      {!collapsed && (
        <div className={styles.backdrop} onClick={toggleSidebar} aria-hidden />
      )}

      <aside className={`${styles.sidebar} ${collapsed ? styles.mini : ''} glass`}>
        <nav className={styles.nav}>
          {menuItems.map((item) => {
            const isActive = isActivePath(item.path);
            return (
              <Link
                key={item.path}
                href={item.path}
                title={collapsed ? item.name : undefined}
                className={`${styles.navLink} ${isActive ? styles.active : ''}`}
              >
                <span className={styles.navIcon}><item.icon size={20} /></span>
                <span className={styles.navLabel}>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className={styles.footer}>
          <div className={`hazard ${styles.hazardStrip}`} />
          <button
            className={styles.collapseBtn}
            onClick={toggleSidebar}
            title={collapsed ? 'Expandir menú' : 'Contraer menú'}
          >
            <span className={styles.navIcon}>
              {collapsed ? <ChevronsRight size={20} /> : <ChevronsLeft size={20} />}
            </span>
            <span className={styles.navLabel}>Contraer menú</span>
          </button>
        </div>
      </aside>

      {/* Botón flotante para abrir en móvil */}
      {collapsed && (
        <button
          className={styles.openBtn}
          onClick={toggleSidebar}
          title="Mostrar menú"
          aria-label="Abrir menú"
        >
          <Menu size={22} />
        </button>
      )}
    </>
  );
}
