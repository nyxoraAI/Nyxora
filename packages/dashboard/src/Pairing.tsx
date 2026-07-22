import React from 'react';
import { Link } from 'lucide-react';

export const Pairing: React.FC = () => {
  return (
    <div className="overview-container" style={{ padding: '40px', color: 'var(--text-secondary)' }}>
      <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
        <Link size={24} color="var(--accent)" />
        Mobile/Desktop Pairing
      </h3>
      <p>Scan a QR code to sync this daemon with the Nyxora Mobile App.</p>
      <p style={{ fontStyle: 'italic', marginTop: '10px' }}>(Coming Soon)</p>
    </div>
  );
};

export default Pairing;
