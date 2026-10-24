import React, { useState, useEffect } from 'react';
import { notify } from '../services/notify';
import { campaignApi, versionApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Inbox,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  Shield,
  FileText,
  User,
  ArrowRight,
} from 'lucide-react';

export function ApprovalInbox({ onSelectCampaign }) {
  const { user } = useAuth();
  const [pendingVersions, setPendingVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [feedbackNotes, setFeedbackNotes] = useState('');
  const [submittingDecision, setSubmittingDecision] = useState(false);

  useEffect(() => {
    loadInbox();
  }, []);

  async function loadInbox() {
    try {
      setLoading(true);
      const res = await campaignApi.list();
      const campaigns = res.data || [];

      const items = [];
      for (const camp of campaigns) {
        // Fetch versions for this campaign
        try {
          const vRes = await versionApi.list(camp._id);
          const versions = vRes.data || [];
          for (const v of versions) {
            if (v.submissionStatus === 'SUBMITTED' || v.submissionStatus === 'IN_REVIEW') {
              items.push({
                ...v,
                campaignName: camp.name,
                clientName: camp.clientName,
                campaignDeadline: camp.deliveryDeadline,
                userRole: camp.userRole,
              });
            }
          }
        } catch (e) {}
      }

      setPendingVersions(items);
      if (items.length > 0) setSelectedVersion(items[0]);
    } catch (err) {
      console.error('Failed to load approval inbox:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDecision(decisionStatus) {
    if (!selectedVersion) return;
    setSubmittingDecision(true);
    try {
      await versionApi.recordDecision(selectedVersion._id, {
        status: decisionStatus,
        feedbackNotes,
      });
      notify(`Decision recorded: ${decisionStatus}`);
      setFeedbackNotes('');
      await loadInbox();
    } catch (err) {
      notify(err.message || 'Failed to record decision', 'error');
    } finally {
      setSubmittingDecision(false);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <Inbox size={24} color="var(--brand-primary)" />
        <div>
          <h2>Brand Reviewer Approval Inbox</h2>
          <p style={{ fontSize: '0.85rem' }}>
            Review submitted script cuts and recorded segments for assigned client campaigns.
          </p>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          Checking pending reviews...
        </div>
      ) : pendingVersions.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <CheckCircle size={48} color="var(--color-success)" style={{ margin: '0 auto 1rem' }} />
          <h3>All Caught Up!</h3>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            There are currently no submitted versions awaiting review for your assigned campaigns.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem' }}>
          {/* Pending Versions List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Awaiting Review ({pendingVersions.length})
            </div>

            {pendingVersions.map((v) => (
              <div
                key={v._id}
                className="glass-card"
                onClick={() => setSelectedVersion(v)}
                style={{
                  padding: '1rem',
                  cursor: 'pointer',
                  border: selectedVersion?._id === v._id ? '1px solid var(--brand-primary)' : '1px solid var(--border-subtle)',
                  background: selectedVersion?._id === v._id ? 'rgba(99, 102, 241, 0.12)' : 'var(--bg-card)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <span className="badge badge-info">{v.clientName}</span>
                  <span className="badge badge-warning">{v.submissionStatus}</span>
                </div>
                <h4 style={{ fontSize: '0.95rem', marginBottom: '0.25rem' }}>
                  v{v.versionNumber}: {v.title}
                </h4>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Campaign: {v.campaignName}
                </div>
              </div>
            ))}
          </div>

          {/* Review Panel */}
          {selectedVersion && (
            <div className="glass-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                <div>
                  <span className="badge badge-info" style={{ marginBottom: '0.4rem' }}>
                    {selectedVersion.clientName}
                  </span>
                  <h3>
                    v{selectedVersion.versionNumber} — {selectedVersion.title}
                  </h3>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    Submitted by {selectedVersion.author?.name || 'Creator'} • Campaign: {selectedVersion.campaignName}
                  </div>
                </div>

                <span className="badge badge-warning">Awaiting Your Decision</span>
              </div>

              {/* Script Viewer */}
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                  Submitted Script / Content:
                </div>
                <pre
                  style={{
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'var(--font-sans)',
                    fontSize: '0.875rem',
                    lineHeight: '1.6',
                    background: 'var(--bg-input)',
                    padding: '1.25rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                    maxHeight: '350px',
                    overflowY: 'auto',
                  }}
                >
                  {selectedVersion.scriptContent}
                </pre>
              </div>

              {/* Decision Box (Reviewer Actions) */}
              <div
                style={{
                  padding: '1.25rem',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-card)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <div style={{ fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-accent)', marginBottom: '0.75rem' }}>
                  Brand Reviewer Decision:
                </div>

                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label">Review Feedback / Revision Notes</label>
                  <textarea
                    id="input-reviewer-feedback"
                    className="form-control"
                    placeholder="Provide specific feedback or requirements for the creator/editor..."
                    value={feedbackNotes}
                    onChange={(e) => setFeedbackNotes(e.target.value)}
                    style={{ minHeight: '70px' }}
                  />
                </div>

                {selectedVersion.userRole === 'REVIEWER' ? (
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <button
                      id="btn-approve-version"
                      className="btn btn-success"
                      onClick={() => handleDecision('APPROVED')}
                      disabled={submittingDecision}
                    >
                      <CheckCircle size={16} /> Approve Version
                    </button>

                    <button
                      id="btn-request-revision"
                      className="btn btn-secondary"
                      onClick={() => handleDecision('REVISION_REQUESTED')}
                      disabled={submittingDecision}
                      style={{ color: 'var(--color-warning)', borderColor: 'rgba(245, 158, 11, 0.4)' }}
                    >
                      <AlertCircle size={16} /> Request Revisions
                    </button>

                    <button
                      id="btn-reject-version"
                      className="btn btn-danger btn-outline"
                      onClick={() => handleDecision('REJECTED')}
                      disabled={submittingDecision}
                    >
                      <XCircle size={16} /> Reject
                    </button>
                  </div>
                ) : (
                  <div style={{ color: 'var(--color-warning)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Shield size={14} /> Only an authorized Brand Reviewer can record approval decisions.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
