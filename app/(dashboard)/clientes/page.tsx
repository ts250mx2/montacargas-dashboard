'use client';

import { Users } from 'lucide-react';
import EntidadPage from '@/components/EntidadPage';

export default function ClientesPage() {
  return (
    <EntidadPage
      titulo="Clientes"
      subtitulo="Catálogo maestro de clientes y condiciones de crédito"
      singular="Cliente"
      api="/api/clientes"
      dataKey="clientes"
      icon={Users}
    />
  );
}
