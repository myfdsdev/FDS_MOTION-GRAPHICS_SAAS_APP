import React from 'react';
import { withDefaults } from '../../helpers';

export const BoardingPass = (props) => {
  const p = withDefaults(props, {
    from: 'NYC',
    fromName: 'New York',
    to: 'LON',
    toName: 'London',
    passenger: 'JANE DOE',
    flight: 'BA118',
    seat: '12A',
    boarding: '17:45',
    background: '#0f172a',
    accent: '#fde047',
    color: '#f8fafc',
  });

  return (
    <div
      style={{
        width: '100%', height: '100%',
        background: p.background,
        borderRadius: 24,
        overflow: 'hidden',
        display: 'flex',
        fontFamily: 'Inter, system-ui, sans-serif',
        color: p.color,
        boxShadow: '0 30px 80px rgba(0,0,0,0.45)',
      }}
    >
      <div style={{ flex: 3, padding: 28, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 20, opacity: 0.7, letterSpacing: '0.16em' }}>BOARDING PASS</div>
          <div style={{ color: p.accent, fontWeight: 800, fontSize: 22 }}>{p.flight}</div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <Code label={p.fromName} code={p.from} />
          <div style={{ flex: 1, height: 2, borderTop: `2px dashed ${p.accent}`, position: 'relative' }}>
            <span style={{ position: 'absolute', top: -16, right: -8, fontSize: 22 }}>✈</span>
          </div>
          <Code label={p.toName} code={p.to} alignRight />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginTop: 'auto' }}>
          <Cell label="PASSENGER" value={p.passenger} />
          <Cell label="SEAT" value={p.seat} />
          <Cell label="BOARDING" value={p.boarding} />
        </div>
      </div>

      <div
        style={{
          flex: 1, background: p.accent,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#0f172a',
          fontWeight: 900, fontSize: 28,
          letterSpacing: '0.2em',
        }}
      >
        {p.seat}
      </div>
    </div>
  );
};

function Code({ label, code, alignRight }) {
  return (
    <div style={{ textAlign: alignRight ? 'right' : 'left' }}>
      <div style={{ fontSize: 16, opacity: 0.6 }}>{label}</div>
      <div style={{ fontSize: 64, fontWeight: 900, lineHeight: 1 }}>{code}</div>
    </div>
  );
}

function Cell({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 13, opacity: 0.6, letterSpacing: '0.14em' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{value}</div>
    </div>
  );
}
