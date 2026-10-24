import React, { useState, useEffect } from 'react';
import { campaignApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Plus, Search, CalendarDays, ArrowRight, Clock3, CheckCircle2,
  Layers3, CircleDot, ClipboardCheck, ChevronRight, X,
  ArrowUpRight, AlertCircle, BriefcaseBusiness,
} from 'lucide-react';

const statuses = {
  PLANNING: { label: 'Planning', style: 'status-planning' },
  IN_PRODUCTION: { label: 'In production', style: 'status-production' },
  IN_REVIEW: { label: 'In review', style: 'status-review' },
  APPROVED: { label: 'Approved', style: 'status-approved' },
};

const filters = [
  { value: 'ALL', label: 'All campaigns' },
  { value: 'PLANNING', label: 'Planning' },
  { value: 'IN_PRODUCTION', label: 'In production' },
  { value: 'IN_REVIEW', label: 'In review' },
  { value: 'APPROVED', label: 'Approved' },
];

const formatDate = (date) => {
  if (!date || Number.isNaN(new Date(date).getTime())) return 'Not scheduled';
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

function CampaignTile({ campaign, onOpen }) {
  const status = statuses[campaign.status] || { label: campaign.status || 'Planning', style: 'status-planning' };
  const deliverables = campaign.deliverables || [];
  const done = deliverables.filter((item) => item.isCompleted).length;
  const percent = deliverables.length ? Math.round((done / deliverables.length) * 100) : 0;
  const days = campaign.deliveryDeadline ? Math.ceil((new Date(campaign.deliveryDeadline) - new Date()) / 86400000) : null;
  const urgent = days !== null && days <= 3 && campaign.status !== 'APPROVED';
  return (
    <button type="button" id={`campaign-card-${campaign.slug}`} className="campaign-tile" onClick={() => onOpen(campaign)}>
      <div className="tile-topline">
        <span className="client-mark">{(campaign.clientName || 'C').slice(0, 1).toUpperCase()}</span>
        <span className={`status-pill ${status.style}`}><span className="status-dot" />{status.label}</span>
      </div>
      <div className="tile-client">{campaign.clientName || 'Unnamed client'}</div>
      <h3 className="tile-title">{campaign.name}</h3>
      <p className="tile-description">{campaign.description || 'Campaign brief and production deliverables.'}</p>
      <div className="tile-divider" />
      <div className="tile-progress-label"><span>Deliverables</span><strong>{done} of {deliverables.length}</strong></div>
      <div className="progress-track" role="progressbar" aria-label={`${campaign.name} deliverables complete`} aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
        <div className="progress-fill" style={{ width: `${percent}%` }} />
      </div>
      <div className="tile-bottom">
        <div className={`tile-date ${urgent ? 'urgent' : ''}`}><CalendarDays size={15} /> {formatDate(campaign.deliveryDeadline)}</div>
        <span className="tile-open">Open workspace <ArrowUpRight size={15} /></span>
      </div>
    </button>
  );
}

export function CampaignBoard({ onSelectCampaign }) {
  const { workspace } = useAuth();
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState('');
  const [clientName, setClientName] = useState('');
  const [deadline, setDeadline] = useState('');
  const [description, setDescription] = useState('');
  const [sponsorTextRequired, setSponsorTextRequired] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  useEffect(() => { loadCampaigns(); }, []);

  async function loadCampaigns() {
    setLoading(true);
    setLoadError('');
    try {
      const res = await campaignApi.list();
      setCampaigns(res.data || []);
    } catch (err) {
      setLoadError(err.message || 'Unable to load campaigns.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateCampaign(e) {
    e.preventDefault();
    if (!workspace) { setCreateError('A workspace is required to create a campaign.'); return; }
    setCreating(true);
    setCreateError('');
    try {
      const res = await campaignApi.create({
        name: name.trim(), clientName: clientName.trim(),
        workspaceId: workspace.id || workspace._id,
        deliveryDeadline: deadline, description: description.trim(),
        deliverables: [{ title: 'Primary Video Deliverable (16:9)', format: 'Video (16:9)', sponsorTextRequired }],
      });
      setShowCreateModal(false);
      setName(''); setClientName(''); setDeadline(''); setDescription(''); setSponsorTextRequired('');
      await loadCampaigns();
      if (res.data) onSelectCampaign(res.data);
    } catch (err) {
      setCreateError(err.message || 'Could not create campaign.');
    } finally {
      setCreating(false);
    }
  }

  const filtered = campaigns.filter((c) => (
    `${c.name || ''} ${c.clientName || ''}`.toLowerCase().includes(searchQuery.toLowerCase().trim()) &&
    (statusFilter === 'ALL' || c.status === statusFilter)
  ));
  const summary = [
    { label: 'Total campaigns', count: campaigns.length, icon: Layers3, accent: 'metric-slate', detail: 'Across your workspace' },
    { label: 'In production', count: campaigns.filter((c) => c.status === 'IN_PRODUCTION').length, icon: CircleDot, accent: 'metric-blue', detail: 'Currently being created' },
    { label: 'Awaiting review', count: campaigns.filter((c) => c.status === 'IN_REVIEW').length, icon: Clock3, accent: 'metric-amber', detail: 'Pending client feedback' },
    { label: 'Approved', count: campaigns.filter((c) => c.status === 'APPROVED').length, icon: CheckCircle2, accent: 'metric-green', detail: 'Ready for delivery' },
  ];

  return (
    <section className="dashboard-page">
      <div className="dashboard-intro">
        <div><div className="eyebrow"><span className="eyebrow-line" /> WORKSPACE OVERVIEW</div><h1>Campaigns, at a glance<span className="title-period">.</span></h1><p>Keep your briefs, production timelines, and approvals in one place.</p></div>
        <button id="btn-new-campaign" className="btn btn-primary new-campaign-button" type="button" onClick={() => setShowCreateModal(true)}><Plus size={17} /> New campaign</button>
      </div>

      <div className="metrics-grid">
        {summary.map(({ label, count, icon: Icon, accent, detail }) => (
          <div className="metric-card" key={label}>
            <div className="metric-heading"><span>{label}</span><div className={`metric-icon ${accent}`}><Icon size={19} strokeWidth={1.9} /></div></div>
            <strong className="metric-number">{loading ? '—' : count.toString().padStart(2, '0')}</strong>
            <div className="metric-detail">{detail}</div>
          </div>
        ))}
      </div>

      <div className="section-head">
        <div><div className="section-overline">YOUR PIPELINE</div><h2>All campaigns <span className="count-chip">{campaigns.length}</span></h2></div>
        <span className="section-helper"><BriefcaseBusiness size={15} /> {workspace?.name || 'Your workspace'}</span>
      </div>

      <div className="campaign-toolbar">
        <label className="campaign-search"><Search size={18} /><input id="input-search-campaigns" type="search" placeholder="Search by campaign or client..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} aria-label="Search campaigns" /></label>
        <div className="filter-tabs" role="group" aria-label="Filter campaigns by status">
          {filters.map((filter) => <button key={filter.value} type="button" className={`filter-tab ${statusFilter === filter.value ? 'selected' : ''}`} aria-pressed={statusFilter === filter.value} onClick={() => setStatusFilter(filter.value)}>{filter.label}</button>)}
        </div>
      </div>

      {loadError && <div className="inline-error" role="alert"><AlertCircle size={17} /><span>{loadError}</span><button type="button" onClick={loadCampaigns}>Retry</button></div>}
      {loading ? (
        <div className="campaign-loading">Loading your campaigns...</div>
      ) : filtered.length === 0 ? (
        <div className="campaign-empty"><div className="empty-icon"><ClipboardCheck size={25} /></div><h3>{campaigns.length ? 'No matching campaigns' : 'Your next great campaign starts here'}</h3><p>{campaigns.length ? 'Try another search or change the status filter.' : 'Create a campaign to organize your team, deadlines, and deliverables.'}</p>{!campaigns.length && <button type="button" className="btn btn-primary" onClick={() => setShowCreateModal(true)}><Plus size={16} /> Create campaign</button>}</div>
      ) : (
        <div className="campaign-grid">{filtered.map((campaign) => <CampaignTile key={campaign._id} campaign={campaign} onOpen={onSelectCampaign} />)}</div>
      )}
      {!loading && filtered.length > 0 && <div className="board-endnote">Showing {filtered.length} of {campaigns.length} campaigns <ChevronRight size={14} /> All changes sync with your workspace</div>}

      {showCreateModal && (
        <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowCreateModal(false); }}>
          <div className="modal-content create-modal" role="dialog" aria-modal="true" aria-labelledby="create-campaign-heading">
            <div className="modal-header"><div><div className="eyebrow">GET STARTED</div><h2 id="create-campaign-heading">New campaign</h2><p>Set up the essentials. You can add more details later.</p></div><button className="icon-button" type="button" onClick={() => setShowCreateModal(false)} aria-label="Close"><X size={21} /></button></div>
            <form onSubmit={handleCreateCampaign}>
              <div className="form-group"><label htmlFor="input-create-campaign-name" className="form-label">Campaign name</label><input id="input-create-campaign-name" className="form-control" placeholder="e.g. Spring product launch" value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} /></div>
              <div className="form-group"><label htmlFor="input-create-client-name" className="form-label">Client / brand</label><input id="input-create-client-name" className="form-control" placeholder="e.g. Northstar Studio" value={clientName} onChange={(e) => setClientName(e.target.value)} required /></div>
              <div className="form-group"><label htmlFor="input-create-deadline" className="form-label">Delivery deadline</label><input id="input-create-deadline" type="date" className="form-control" min={new Date().toISOString().slice(0, 10)} value={deadline} onChange={(e) => setDeadline(e.target.value)} required /></div>
              <div className="form-group"><label htmlFor="input-create-description" className="form-label">Description <span className="optional-field">Optional</span></label><textarea id="input-create-description" className="form-control" placeholder="What's the goal of this campaign?" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
              <div className="form-group"><label htmlFor="input-create-sponsor-text" className="form-label">Required sponsor copy <span className="optional-field">Optional</span></label><textarea id="input-create-sponsor-text" className="form-control" placeholder="Required messaging, legal copy, promo codes..." value={sponsorTextRequired} onChange={(e) => setSponsorTextRequired(e.target.value)} /></div>
              {createError && <div className="inline-error" role="alert"><AlertCircle size={16} />{createError}</div>}
              <div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button><button id="btn-submit-create-campaign" type="submit" className="btn btn-primary" disabled={creating}>{creating ? 'Creating...' : 'Create campaign'} <ArrowRight size={15} /></button></div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
