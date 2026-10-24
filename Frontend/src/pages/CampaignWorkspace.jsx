import React, { useState, useEffect } from 'react';
import { notify } from '../services/notify';
import {
  briefApi,
  assetApi,
  versionApi,
  taskApi,
  commentApi,
  campaignApi,
} from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  FileText,
  Video,
  Music,
  Image,
  Upload,
  Search,
  CheckCircle,
  AlertTriangle,
  Clock,
  MessageSquare,
  GitCompare,
  Plus,
  Send,
  Eye,
  Download,
  Shield,
  Layers,
  Sparkles,
  UserCheck,
} from 'lucide-react';

export function CampaignWorkspace({ campaign, onUpdateCampaign }) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('brief'); // 'brief' | 'assets' | 'versions' | 'tasks' | 'activity' | 'showcase'

  // Brief Tab State
  const [briefs, setBriefs] = useState([]);
  const [activeBrief, setActiveBrief] = useState(null);
  const [briefQuery, setBriefQuery] = useState('');
  const [ragResult, setRagResult] = useState(null);
  const [ragLoading, setRagLoading] = useState(false);
  const [briefFile, setBriefFile] = useState(null);
  const [briefUploading, setBriefUploading] = useState(false);

  // Asset Tab State
  const [assets, setAssets] = useState([]);
  const [assetSearchQuery, setAssetSearchQuery] = useState('');
  const [assetTypeFilter, setAssetTypeFilter] = useState('');
  const [assetUploading, setAssetUploading] = useState(false);
  const [showAssetModal, setShowAssetModal] = useState(false);
  const [newAssetTitle, setNewAssetTitle] = useState('');
  const [newAssetType, setNewAssetType] = useState('VIDEO');
  const [newAssetCaption, setNewAssetCaption] = useState('');
  const [newAssetTags, setNewAssetTags] = useState('');
  const [newAssetFile, setNewAssetFile] = useState(null);

  // Versions Tab State
  const [versions, setVersions] = useState([]);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [comments, setComments] = useState([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [compareV1, setCompareV1] = useState('');
  const [compareV2, setCompareV2] = useState('');
  const [comparisonResult, setComparisonResult] = useState(null);
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [newVersionTitle, setNewVersionTitle] = useState('');
  const [newVersionScript, setNewVersionScript] = useState('');
  const [newVersionSubmit, setNewVersionSubmit] = useState(true);

  // Tasks Tab State
  const [tasks, setTasks] = useState([]);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState('HIGH');

  // Activity State
  const [activities, setActivities] = useState([]);

  // Showcase Consent State
  const [isConsented, setIsConsented] = useState(campaign.isPublicShowcaseConsented || false);
  const [showcaseDesc, setShowcaseDesc] = useState(campaign.showcaseDescription || '');

  const userRole = campaign.userRole || 'PRODUCER';
  const isProducer = userRole === 'PRODUCER';
  const isEditor = userRole === 'EDITOR';
  const isReviewer = userRole === 'REVIEWER';

  useEffect(() => {
    loadBriefs();
    loadAssets();
    loadVersions();
    loadTasks();
    loadActivities();
  }, [campaign._id]);

  // Load functions
  async function loadBriefs() {
    try {
      const res = await briefApi.list(campaign._id);
      setBriefs(res.data || []);
      if (res.data?.length > 0) setActiveBrief(res.data[0]);
    } catch (e) {}
  }

  async function loadAssets() {
    try {
      const res = await assetApi.list(campaign._id, assetTypeFilter);
      setAssets(res.data || []);
    } catch (e) {}
  }

  async function loadVersions() {
    try {
      const res = await versionApi.list(campaign._id);
      setVersions(res.data || []);
      if (res.data?.length > 0) {
        setSelectedVersion(res.data[0]);
        loadComments(res.data[0]._id);
      }
    } catch (e) {}
  }

  async function loadComments(versionId) {
    try {
      const res = await commentApi.list(versionId);
      setComments(res.data || []);
    } catch (e) {}
  }

  async function loadTasks() {
    try {
      const res = await taskApi.list(campaign._id);
      setTasks(res.data || []);
    } catch (e) {}
  }

  async function loadActivities() {
    try {
      const res = await campaignApi.getActivity(campaign._id);
      setActivities(res.data || []);
    } catch (e) {}
  }

  // Brief Upload
  async function handleBriefUpload(e) {
    e.preventDefault();
    if (!briefFile) return;
    setBriefUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', briefFile);
      formData.append('title', briefFile.name.replace(/\.[^/.]+$/, ''));
      await briefApi.upload(campaign._id, formData);
      setBriefFile(null);
      await loadBriefs();
      await loadActivities();
      notify('Brief revision uploaded and indexed with vector search successfully!');
    } catch (err) {
      notify(err.message || 'Brief upload failed', 'error');
    } finally {
      setBriefUploading(false);
    }
  }

  // Brief RAG Query
  async function handleAskBrief(e) {
    e.preventDefault();
    if (!briefQuery.trim()) return;
    setRagLoading(true);
    try {
      const res = await briefApi.ask(campaign._id, briefQuery);
      setRagResult(res.data);
    } catch (err) {
      notify(err.message || 'Brief inquiry failed', 'error');
    } finally {
      setRagLoading(false);
    }
  }

  // Asset Search
  async function handleAssetSearch(e) {
    e.preventDefault();
    try {
      if (!assetSearchQuery.trim()) {
        await loadAssets();
        return;
      }
      const res = await assetApi.search(campaign._id, { query: assetSearchQuery, assetType: assetTypeFilter });
      setAssets(res.data || []);
    } catch (err) {
      console.error(err);
    }
  }

  // Asset Upload
  async function handleAssetUpload(e) {
    e.preventDefault();
    if (!newAssetFile) return;
    setAssetUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', newAssetFile);
      formData.append('title', newAssetTitle);
      formData.append('assetType', newAssetType);
      formData.append('caption', newAssetCaption);
      formData.append('tags', newAssetTags);
      await assetApi.upload(campaign._id, formData);
      setShowAssetModal(false);
      setNewAssetTitle('');
      setNewAssetCaption('');
      setNewAssetTags('');
      setNewAssetFile(null);
      await loadAssets();
      await loadActivities();
    } catch (err) {
      notify(err.message || 'Asset upload failed', 'error');
    } finally {
      setAssetUploading(false);
    }
  }

  // Version Creation
  async function handleCreateVersion(e) {
    e.preventDefault();
    try {
      await versionApi.create(campaign._id, {
        title: newVersionTitle,
        scriptContent: newVersionScript,
        submitForReview: newVersionSubmit,
      });
      setShowVersionModal(false);
      setNewVersionTitle('');
      setNewVersionScript('');
      await loadVersions();
      await loadActivities();
    } catch (err) {
      notify(err.message || 'Version creation failed', 'error');
    }
  }

  // Version Comparison
  async function handleCompareVersions() {
    if (!compareV1 || !compareV2) return;
    try {
      const res = await versionApi.compare(compareV1, compareV2);
      setComparisonResult(res.data);
    } catch (err) {
      notify(err.message || 'Comparison failed', 'error');
    }
  }

  // Comment Add
  async function handleAddComment(e) {
    e.preventDefault();
    if (!newCommentText.trim() || !selectedVersion) return;
    try {
      await commentApi.add(selectedVersion._id, { text: newCommentText });
      setNewCommentText('');
      await loadComments(selectedVersion._id);
    } catch (err) {
      notify(err.message || 'Failed to add comment', 'error');
    }
  }

  // Task Status Update
  async function handleTaskStatusChange(taskId, newStatus) {
    try {
      await taskApi.update(taskId, { status: newStatus });
      await loadTasks();
      await loadActivities();
    } catch (err) {
      notify(err.message || 'Failed to update task', 'error');
    }
  }

  // Task Create
  async function handleCreateTask(e) {
    e.preventDefault();
    try {
      await taskApi.create(campaign._id, {
        title: newTaskTitle,
        dueDate: newTaskDueDate,
        priority: newTaskPriority,
      });
      setShowTaskModal(false);
      setNewTaskTitle('');
      setNewTaskDueDate('');
      await loadTasks();
      await loadActivities();
    } catch (err) {
      notify(err.message || 'Failed to create task', 'error');
    }
  }

  // Showcase Consent
  async function handleShowcaseConsent(consentVal) {
    try {
      const res = await campaignApi.consentShowcase(campaign._id, {
        isConsented: consentVal,
        showcaseDescription: showcaseDesc,
      });
      setIsConsented(consentVal);
      notify(res.message);
    } catch (err) {
      notify(err.message || 'Showcase consent update failed', 'error');
    }
  }

  return (
    <div>
      {/* Workspace Header Info */}
      <div
        className="glass-card"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem',
          padding: '1rem 1.5rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span className="badge badge-info">{campaign.clientName}</span>
            <span className="badge badge-neutral">Due: {new Date(campaign.deliveryDeadline).toLocaleDateString()}</span>
            <span className={`badge ${campaign.status === 'APPROVED' ? 'badge-success' : 'badge-warning'}`}>
              {campaign.status}
            </span>
          </div>
          <h2>{campaign.name}</h2>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span className="badge badge-primary">
            <Shield size={12} /> {userRole}
          </span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="tabs-nav">
        <button
          id="tab-brief"
          className={`tab-btn ${activeTab === 'brief' ? 'active' : ''}`}
          onClick={() => setActiveTab('brief')}
        >
          <FileText size={16} /> Brief & RAG Intelligence
        </button>
        <button
          id="tab-assets"
          className={`tab-btn ${activeTab === 'assets' ? 'active' : ''}`}
          onClick={() => setActiveTab('assets')}
        >
          <Video size={16} /> Asset Library & Rights
        </button>
        <button
          id="tab-versions"
          className={`tab-btn ${activeTab === 'versions' ? 'active' : ''}`}
          onClick={() => setActiveTab('versions')}
        >
          <GitCompare size={16} /> Versions & Comparison
        </button>
        <button
          id="tab-tasks"
          className={`tab-btn ${activeTab === 'tasks' ? 'active' : ''}`}
          onClick={() => setActiveTab('tasks')}
        >
          <Clock size={16} /> Tasks & Production Schedule
        </button>
        <button
          id="tab-activity"
          className={`tab-btn ${activeTab === 'activity' ? 'active' : ''}`}
          onClick={() => setActiveTab('activity')}
        >
          <Layers size={16} /> Activity Audit
        </button>
        {isProducer && (
          <button
            id="tab-showcase-settings"
            className={`tab-btn ${activeTab === 'showcase' ? 'active' : ''}`}
            onClick={() => setActiveTab('showcase')}
          >
            <UserCheck size={16} /> Public Consent
          </button>
        )}
      </div>

      {/* ================= TAB 1: BRIEF & RAG INTELLIGENCE ================= */}
      {activeTab === 'brief' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          {/* Left: Brief Document & Revisions */}
          <div className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3>Sponsor Brief Document</h3>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                {briefs.map((b) => (
                  <button
                    key={b._id}
                    className={`btn btn-sm ${activeBrief?._id === b._id ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveBrief(b)}
                  >
                    v{b.revisionNumber} {b.status === 'ACTIVE' ? '(Current)' : ''}
                  </button>
                ))}
              </div>
            </div>

            {/* Brief Upload (Producer only) */}
            {isProducer && (
              <form
                onSubmit={handleBriefUpload}
                style={{
                  padding: '1rem',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px dashed var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: '1.25rem',
                }}
              >
                <div style={{ fontSize: '0.8rem', fontWeight: '600', marginBottom: '0.5rem', color: 'var(--text-accent)' }}>
                  Upload New Brief Revision (PDF or TXT)
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="file"
                    accept=".pdf,.txt,.md"
                    className="form-control"
                    onChange={(e) => setBriefFile(e.target.files[0])}
                    style={{ fontSize: '0.8rem' }}
                    required
                  />
                  <button type="submit" className="btn btn-primary btn-sm" disabled={briefUploading}>
                    {briefUploading ? 'Indexing...' : 'Upload & Re-Index'}
                  </button>
                </div>
              </form>
            )}

            {/* Brief Content Viewer */}
            {activeBrief ? (
              <div style={{ maxHeight: '550px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                  <span>Filename: {activeBrief.originalFilename}</span>
                  <span>Revision: v{activeBrief.revisionNumber}</span>
                </div>
                <pre
                  style={{
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'var(--font-sans)',
                    fontSize: '0.85rem',
                    lineHeight: '1.6',
                    color: 'var(--text-primary)',
                    background: 'var(--bg-input)',
                    padding: '1rem',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  {activeBrief.extractedText}
                </pre>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                No brief uploaded yet.
              </div>
            )}
          </div>

          {/* Right: RAG Brief Q&A Assistant */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <Sparkles size={20} color="var(--brand-primary)" />
              <h3>Brief RAG Intelligence</h3>
            </div>
            <p style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
              Ask questions about mandatory sponsor claims, required disclaimers, or usage terms. All answers are grounded with traceable citations.
            </p>

            {/* Question Form */}
            <form onSubmit={handleAskBrief} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <input
                id="input-brief-rag-query"
                type="text"
                className="form-control"
                placeholder="e.g. What is the mandatory discount code and battery life claim?"
                value={briefQuery}
                onChange={(e) => setBriefQuery(e.target.value)}
                required
              />
              <button id="btn-ask-brief-rag" type="submit" className="btn btn-primary" disabled={ragLoading}>
                {ragLoading ? 'Searching...' : 'Ask Brief'}
              </button>
            </form>

            {/* RAG Result */}
            {ragResult && (
              <div
                style={{
                  flex: 1,
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.25rem',
                  overflowY: 'auto',
                }}
              >
                <div style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--brand-primary)', marginBottom: '0.5rem' }}>
                  Synthesized Answer:
                </div>
                <div style={{ fontSize: '0.9rem', lineHeight: '1.6', color: 'var(--text-primary)', marginBottom: '1rem' }}>
                  {ragResult.answer}
                </div>

                {/* Citations */}
                {ragResult.citations?.length > 0 && (
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-accent)', marginBottom: '0.5rem' }}>
                      Traceable Citations:
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {ragResult.citations.map((c, i) => (
                        <div
                          key={i}
                          style={{
                            padding: '0.5rem 0.75rem',
                            background: 'rgba(255, 255, 255, 0.03)',
                            borderLeft: '3px solid var(--brand-primary)',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '0.8rem',
                          }}
                        >
                          <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                            {c.briefTitle} (v{c.revision}) — Section: {c.sectionTitle}
                          </div>
                          <div style={{ color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: '0.2rem' }}>
                            "{c.excerpt}"
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= TAB 2: ASSET LIBRARY & RIGHTS ================= */}
      {activeTab === 'assets' && (
        <div>
          {/* Controls Bar */}
          <div
            className="glass-card"
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}
          >
            <form onSubmit={handleAssetSearch} style={{ display: 'flex', gap: '0.5rem', flex: 1, minWidth: '280px' }}>
              <input
                id="input-asset-semantic-search"
                type="text"
                className="form-control"
                placeholder="Semantic search (e.g. 'upbeat music intro', 'close-up b-roll')..."
                value={assetSearchQuery}
                onChange={(e) => setAssetSearchQuery(e.target.value)}
              />
              <button type="submit" className="btn btn-secondary">
                <Search size={16} /> Search
              </button>
            </form>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              {['', 'VIDEO', 'AUDIO', 'IMAGE'].map((t) => (
                <button
                  key={t}
                  className={`btn btn-sm ${assetTypeFilter === t ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => {
                    setAssetTypeFilter(t);
                    assetApi.list(campaign._id, t).then((res) => setAssets(res.data || []));
                  }}
                >
                  {t || 'All Types'}
                </button>
              ))}

              {(isProducer || isEditor) && (
                <button
                  id="btn-upload-asset"
                  className="btn btn-primary"
                  onClick={() => setShowAssetModal(true)}
                >
                  <Upload size={16} /> Upload Asset
                </button>
              )}
            </div>
          </div>

          {/* Assets Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
            {assets.map((asset) => {
              const rights = asset.rightsAssessment || {};
              const isExpired = !rights.isUsable;

              return (
                <div
                  key={asset._id}
                  className="glass-card"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    border: isExpired ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid var(--border-card)',
                  }}
                >
                  {/* Card Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {asset.assetType === 'VIDEO' ? (
                        <Video size={20} color="var(--brand-primary)" />
                      ) : asset.assetType === 'AUDIO' ? (
                        <Music size={20} color="var(--color-warning)" />
                      ) : (
                        <Image size={20} color="var(--color-success)" />
                      )}
                      <div>
                        <h4 style={{ fontSize: '1rem', fontWeight: '600' }}>{asset.title}</h4>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{asset.originalFilename}</span>
                      </div>
                    </div>

                    <span className={`badge ${isExpired ? 'badge-danger' : 'badge-success'}`}>
                      {isExpired ? 'EXPIRED / RESTRICTED' : 'USABLE'}
                    </span>
                  </div>

                  {asset.caption && (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', lineClamp: 2 }}>
                      {asset.caption}
                    </p>
                  )}

                  {/* Usage Rights Box */}
                  <div
                    style={{
                      padding: '0.75rem',
                      background: isExpired ? 'var(--color-danger-bg)' : 'rgba(255, 255, 255, 0.02)',
                      borderRadius: 'var(--radius-md)',
                      border: `1px solid ${isExpired ? 'rgba(239, 68, 68, 0.3)' : 'var(--border-subtle)'}`,
                      marginBottom: '1rem',
                      fontSize: '0.8rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Owner:</span>
                      <strong>{rights.owner || 'Client'}</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>License Expiry:</span>
                      <span style={{ color: isExpired ? 'var(--color-danger)' : 'var(--text-primary)', fontWeight: '600' }}>
                        {rights.licenseEndDate ? new Date(rights.licenseEndDate).toLocaleDateString() : 'Perpetual'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Channels:</span>
                      <span>{(rights.allowedChannels || []).join(', ')}</span>
                    </div>

                    {isExpired && rights.issues?.length > 0 && (
                      <div style={{ marginTop: '0.5rem', color: 'var(--color-danger)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <AlertTriangle size={13} /> {rights.issues[0]}
                      </div>
                    )}
                  </div>

                  {/* Footer actions */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '0.5rem', borderTop: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                      {(asset.tags || []).slice(0, 3).map((tg, i) => (
                        <span key={i} style={{ fontSize: '0.7rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.04)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                          #{tg}
                        </span>
                      ))}
                    </div>

                    <a
                      href={assetApi.downloadUrl(campaign._id, asset._id)}
                      className="btn btn-outline btn-sm"
                      download
                    >
                      <Download size={13} /> Download
                    </a>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ASSET UPLOAD MODAL */}
          {showAssetModal && (
            <div className="modal-overlay" onClick={() => setShowAssetModal(false)}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h3 style={{ marginBottom: '1.25rem' }}>Upload Production Asset</h3>
                <form onSubmit={handleAssetUpload}>
                  <div className="form-group">
                    <label className="form-label">Asset Title</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Upbeat Intro Soundtrack"
                      value={newAssetTitle}
                      onChange={(e) => setNewAssetTitle(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Asset Type</label>
                    <select
                      className="form-control"
                      value={newAssetType}
                      onChange={(e) => setNewAssetType(e.target.value)}
                    >
                      <option value="VIDEO">Video</option>
                      <option value="AUDIO">Audio</option>
                      <option value="IMAGE">Image</option>
                      <option value="DOCUMENT">Document / Script</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Caption / Description</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Describe what is in this asset..."
                      value={newAssetCaption}
                      onChange={(e) => setNewAssetCaption(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Tags (comma separated)</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. music, upbeat, intro"
                      value={newAssetTags}
                      onChange={(e) => setNewAssetTags(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">File</label>
                    <input
                      type="file"
                      className="form-control"
                      onChange={(e) => setNewAssetFile(e.target.files[0])}
                      required
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setShowAssetModal(false)}>
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={assetUploading}>
                      {assetUploading ? 'Uploading...' : 'Save Asset'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= TAB 3: VERSIONS & COMPARISON ================= */}
      {activeTab === 'versions' && (
        <div>
          {/* Version Header & Compare Controls */}
          <div
            className="glass-card"
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}
          >
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Compare:</span>
              <select
                className="form-control"
                value={compareV1}
                onChange={(e) => setCompareV1(e.target.value)}
                style={{ width: '150px' }}
              >
                <option value="">Select v1</option>
                {versions.map((v) => (
                  <option key={v._id} value={v._id}>
                    v{v.versionNumber} ({v.title})
                  </option>
                ))}
              </select>

              <span style={{ color: 'var(--text-muted)' }}>vs</span>

              <select
                className="form-control"
                value={compareV2}
                onChange={(e) => setCompareV2(e.target.value)}
                style={{ width: '150px' }}
              >
                <option value="">Select v2</option>
                {versions.map((v) => (
                  <option key={v._id} value={v._id}>
                    v{v.versionNumber} ({v.title})
                  </option>
                ))}
              </select>

              <button className="btn btn-secondary btn-sm" onClick={handleCompareVersions}>
                <GitCompare size={14} /> Compare
              </button>
            </div>

            {(isProducer || isEditor) && (
              <button
                id="btn-new-version"
                className="btn btn-primary"
                onClick={() => setShowVersionModal(true)}
              >
                <Plus size={16} /> Submit New Version
              </button>
            )}
          </div>

          {/* Comparison Side-by-Side View (If Active) */}
          {comparisonResult && (
            <div className="glass-card" style={{ marginBottom: '2rem', border: '1px solid var(--brand-primary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h4>Side-by-Side Script Comparison</h4>
                <button className="btn btn-outline btn-sm" onClick={() => setComparisonResult(null)}>
                  Close Comparison
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                {/* Version 1 */}
                <div style={{ background: 'var(--bg-input)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <strong>v{comparisonResult.version1.versionNumber} — {comparisonResult.version1.title}</strong>
                    <span className="badge badge-neutral">{comparisonResult.version1.submissionStatus}</span>
                  </div>
                  <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--font-sans)', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {comparisonResult.version1.scriptContent}
                  </pre>
                </div>

                {/* Version 2 */}
                <div style={{ background: 'var(--bg-input)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <strong>v{comparisonResult.version2.versionNumber} — {comparisonResult.version2.title}</strong>
                    <span className="badge badge-neutral">{comparisonResult.version2.submissionStatus}</span>
                  </div>
                  <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--font-sans)', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {comparisonResult.version2.scriptContent}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* Selected Version Detail + Comments */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
            {/* Version Script & Media */}
            <div className="glass-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  {versions.map((v) => (
                    <button
                      key={v._id}
                      className={`btn btn-sm ${selectedVersion?._id === v._id ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => {
                        setSelectedVersion(v);
                        loadComments(v._id);
                      }}
                    >
                      v{v.versionNumber}
                    </button>
                  ))}
                </div>

                {selectedVersion && (
                  <span
                    className={`badge ${
                      selectedVersion.submissionStatus === 'APPROVED'
                        ? 'badge-success'
                        : selectedVersion.submissionStatus === 'REVISION_REQUESTED'
                        ? 'badge-warning'
                        : 'badge-info'
                    }`}
                  >
                    {selectedVersion.submissionStatus}
                  </span>
                )}
              </div>

              {selectedVersion ? (
                <div>
                  <h3 style={{ marginBottom: '0.25rem' }}>{selectedVersion.title}</h3>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                    Submitted by {selectedVersion.author?.name || 'Producer'} on{' '}
                    {new Date(selectedVersion.createdAt).toLocaleString()}
                  </div>

                  <div style={{ marginBottom: '1.25rem' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                      Script & Production Content:
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
                      }}
                    >
                      {selectedVersion.scriptContent}
                    </pre>
                  </div>

                  {/* Decisions on this version */}
                  {selectedVersion.decisions?.length > 0 && (
                    <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-accent)', marginBottom: '0.5rem' }}>
                        Brand Reviewer Decisions:
                      </div>
                      {selectedVersion.decisions.map((dec, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                          <span>Status: <strong>{dec.status}</strong></span>
                          <span>Notes: {dec.feedbackNotes || 'None'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  No versions submitted yet.
                </div>
              )}
            </div>

            {/* Version Feedback Comments */}
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <MessageSquare size={18} color="var(--brand-primary)" />
                <h4>Revision Comments ({comments.length})</h4>
              </div>

              <div style={{ flex: 1, maxHeight: '400px', overflowY: 'auto', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {comments.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    No comments on this version.
                  </div>
                ) : (
                  comments.map((c) => (
                    <div key={c._id} style={{ padding: '0.75rem', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                        <strong>{c.author?.name || 'Reviewer'}</strong>
                        <span>{new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div style={{ color: 'var(--text-primary)' }}>{c.text}</div>
                    </div>
                  ))
                )}
              </div>

              {/* Add Comment Input */}
              <form onSubmit={handleAddComment} style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Leave review comment..."
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  style={{ fontSize: '0.8rem' }}
                />
                <button type="submit" className="btn btn-primary btn-sm">
                  <Send size={14} />
                </button>
              </form>
            </div>
          </div>

          {/* NEW VERSION MODAL */}
          {showVersionModal && (
            <div className="modal-overlay" onClick={() => setShowVersionModal(false)}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h3 style={{ marginBottom: '1.25rem' }}>Submit New Script / Production Cut</h3>
                <form onSubmit={handleCreateVersion}>
                  <div className="form-group">
                    <label className="form-label">Version Title</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Revised Cut v2 with Sound Polish"
                      value={newVersionTitle}
                      onChange={(e) => setNewVersionTitle(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Script & Production Dialogue</label>
                    <textarea
                      className="form-control"
                      placeholder="Paste complete script content including all sponsor claims and promo codes..."
                      value={newVersionScript}
                      onChange={(e) => setNewVersionScript(e.target.value)}
                      style={{ minHeight: '160px' }}
                      required
                    />
                  </div>

                  <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      type="checkbox"
                      id="check-submit"
                      checked={newVersionSubmit}
                      onChange={(e) => setNewVersionSubmit(e.target.checked)}
                    />
                    <label htmlFor="check-submit" style={{ fontSize: '0.85rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                      Submit immediately for Brand Reviewer approval
                    </label>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setShowVersionModal(false)}>
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary">
                      Submit Version
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= TAB 4: TASKS & PRODUCTION SCHEDULE ================= */}
      {activeTab === 'tasks' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div>
              <h3>Production Schedule & Tasks</h3>
              <p style={{ fontSize: '0.85rem' }}>
                Track deadlines, assignments, and schedule conflicts.
              </p>
            </div>

            {isProducer && (
              <button
                id="btn-add-task"
                className="btn btn-primary"
                onClick={() => setShowTaskModal(true)}
              >
                <Plus size={16} /> Add Task
              </button>
            )}
          </div>

          {/* Kanban / Task Columns */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
            {['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'].map((col) => {
              const colTasks = tasks.filter((t) => t.status === col);
              return (
                <div
                  key={col}
                  style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '1rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h4 style={{ fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{col}</h4>
                    <span className="badge badge-neutral">{colTasks.length}</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {colTasks.map((t) => {
                      const isAfterDeadline = new Date(t.dueDate) > new Date(campaign.deliveryDeadline);
                      return (
                        <div
                          key={t._id}
                          className="glass-card"
                          style={{
                            padding: '0.85rem',
                            border: isAfterDeadline ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid var(--border-subtle)',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>{t.title}</span>
                            <span
                              className={`badge ${
                                t.priority === 'URGENT'
                                  ? 'badge-danger'
                                  : t.priority === 'HIGH'
                                  ? 'badge-warning'
                                  : 'badge-neutral'
                              }`}
                              style={{ fontSize: '0.65rem' }}
                            >
                              {t.priority}
                            </span>
                          </div>

                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                            Assigned: {t.assignedTo?.name || 'Unassigned'}
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
                            <span style={{ color: isAfterDeadline ? 'var(--color-danger)' : 'var(--text-secondary)' }}>
                              Due: {new Date(t.dueDate).toLocaleDateString()}
                            </span>

                            {/* Status Change Selector */}
                            <select
                              value={t.status}
                              onChange={(e) => handleTaskStatusChange(t._id, e.target.value)}
                              style={{
                                background: 'transparent',
                                border: '1px solid var(--border-subtle)',
                                color: 'var(--text-primary)',
                                borderRadius: '4px',
                                fontSize: '0.7rem',
                                padding: '0.1rem',
                              }}
                            >
                              <option value="TODO">TODO</option>
                              <option value="IN_PROGRESS">IN_PROGRESS</option>
                              <option value="REVIEW">REVIEW</option>
                              <option value="DONE">DONE</option>
                            </select>
                          </div>

                          {isAfterDeadline && (
                            <div style={{ marginTop: '0.4rem', color: 'var(--color-danger)', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                              <AlertTriangle size={12} /> Exceeds campaign deadline!
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ADD TASK MODAL */}
          {showTaskModal && (
            <div className="modal-overlay" onClick={() => setShowTaskModal(false)}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h3 style={{ marginBottom: '1.25rem' }}>Create Production Task</h3>
                <form onSubmit={handleCreateTask}>
                  <div className="form-group">
                    <label className="form-label">Task Title</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Color grade b-roll footage"
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Due Date</label>
                    <input
                      type="date"
                      className="form-control"
                      value={newTaskDueDate}
                      onChange={(e) => setNewTaskDueDate(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Priority</label>
                    <select
                      className="form-control"
                      value={newTaskPriority}
                      onChange={(e) => setNewTaskPriority(e.target.value)}
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                      <option value="URGENT">Urgent</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setShowTaskModal(false)}>
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary">
                      Create Task
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= TAB 5: ACTIVITY TIMELINE ================= */}
      {activeTab === 'activity' && (
        <div className="glass-card">
          <h3 style={{ marginBottom: '1.5rem' }}>Campaign Activity & Audit Trail</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {activities.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                No recorded activity yet.
              </div>
            ) : (
              activities.map((act) => (
                <div
                  key={act._id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '1rem',
                    padding: '0.75rem 1rem',
                    background: 'var(--bg-input)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: 'rgba(99, 102, 241, 0.15)',
                      color: 'var(--brand-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Layers size={16} />
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                      <strong style={{ fontSize: '0.85rem' }}>{act.action}</strong>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {new Date(act.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Performed by {act.actor?.name || 'System User'} on {act.resourceType}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ================= TAB 6: PUBLIC CONSENT (Producer only) ================= */}
      {activeTab === 'showcase' && isProducer && (
        <div className="glass-card" style={{ maxWidth: '600px' }}>
          <h3 style={{ marginBottom: '1rem' }}>Public Showcase Settings</h3>
          <p style={{ fontSize: '0.85rem', marginBottom: '1.5rem' }}>
            Allow approved campaign work to appear on the public showcase page. All confidential briefs, internal comments, and private assets remain strictly hidden.
          </p>

          <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <input
              type="checkbox"
              id="check-consent"
              checked={isConsented}
              onChange={(e) => handleShowcaseConsent(e.target.checked)}
              style={{ width: '18px', height: '18px' }}
            />
            <label htmlFor="check-consent" style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-primary)', cursor: 'pointer' }}>
              Publish this campaign to the Public Showcase
            </label>
          </div>

          <div className="form-group">
            <label className="form-label">Public Description</label>
            <textarea
              className="form-control"
              placeholder="Public description of the finished creator campaign..."
              value={showcaseDesc}
              onChange={(e) => setShowcaseDesc(e.target.value)}
              style={{ minHeight: '80px' }}
            />
          </div>

          <button
            className="btn btn-primary btn-sm"
            onClick={() => handleShowcaseConsent(isConsented)}
          >
            Save Showcase Settings
          </button>
        </div>
      )}
    </div>
  );
}
