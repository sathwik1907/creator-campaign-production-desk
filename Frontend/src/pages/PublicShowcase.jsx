import React, { useState, useEffect } from 'react';
import { showcaseApi } from '../services/api';
import { Globe, Sparkles, CheckCircle, ArrowLeft, Video, ShieldCheck } from 'lucide-react';

export function PublicShowcase({ onBack }) {
  const [samples, setSamples] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSample, setSelectedSample] = useState(null);

  useEffect(() => {
    loadShowcase();
  }, []);

  async function loadShowcase() {
    try {
      setLoading(true);
      const res = await showcaseApi.list();
      setSamples(res.data || []);
    } catch (err) {
      console.error('Failed to load public showcase:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', paddingBottom: '3rem' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--brand-gradient)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
            }}
          >
            <Globe size={22} />
          </div>
          <div>
            <h2>Creator Campaign Public Showcase</h2>
            <p style={{ fontSize: '0.85rem' }}>
              Consented and approved public campaign deliverables. Private briefs and internal discussions remain protected.
            </p>
          </div>
        </div>

        {onBack && (
          <button className="btn btn-secondary btn-sm" onClick={onBack}>
            <ArrowLeft size={14} /> Back to Desk
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          Loading public showcase...
        </div>
      ) : samples.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <ShieldCheck size={48} color="var(--brand-primary)" style={{ margin: '0 auto 1rem' }} />
          <h3>No Public Samples Consented</h3>
          <p style={{ maxWidth: '420px', margin: '0.5rem auto 1.5rem', color: 'var(--text-secondary)' }}>
            Only campaigns where a producer has explicitly enabled showcase consent and brand approval is finalized will appear here.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.5rem' }}>
          {samples.map((item, idx) => (
            <div key={idx} className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                <span className="badge badge-info">{item.clientName}</span>
                <span className="badge badge-success">
                  <CheckCircle size={12} /> APPROVED
                </span>
              </div>

              <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>{item.title}</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', flex: 1 }}>
                {item.description}
              </p>

              {item.approvedVersion && (
                <div
                  style={{
                    padding: '0.85rem',
                    background: 'var(--bg-input)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '0.8rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: '600', color: 'var(--text-accent)', marginBottom: '0.4rem' }}>
                    <Video size={14} /> Approved Cut: {item.approvedVersion.versionNumber} ({item.approvedVersion.title})
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontStyle: 'italic', lineClamp: 3 }}>
                    "{item.approvedVersion.scriptExcerpt}"
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
