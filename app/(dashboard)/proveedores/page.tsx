'use client';

import { Truck } from 'lucide-react';
import EntidadPage from '@/components/EntidadPage';

export default function ProveedoresPage() {
  return (
    <EntidadPage
      titulo="Proveedores"
      subtitulo="Catálogo maestro de proveedores"
      singular="Proveedor"
      api="/api/proveedores"
      dataKey="proveedores"
      icon={Truck}
    />
  );
}
