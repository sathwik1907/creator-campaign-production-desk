import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import { AuthPages } from './pages/AuthPages';
import { AppLayout } from './layouts/AppLayout';
import { CampaignBoard } from './pages/CampaignBoard';
import { CampaignWorkspace } from './pages/CampaignWorkspace';
import { ApprovalInbox } from './pages/ApprovalInbox';
import { ProductionAssistant } from './pages/ProductionAssistant';
import { PublicShowcase } from './pages/PublicShowcase';
import { campaignApi } from './services/api';

export function App() {
  const { user, loading } = useAuth();
  const [currentView, setCurrentView] = useState('campaigns'); // 'campaigns' | 'workspace' | 'inbox' | 'assistant' | 'showcase'
  const [activeCampaign, setActiveCampaign] = useState(null);
  const [allCampaigns, setAllCampaigns] = useState([]);

  useEffect(() => {
    // Never retain campaign state when another account signs in.
    setActiveCampaign(null);
    setAllCampaigns([]);
    setCurrentView('campaigns');
    if (user) loadAllCampaigns();
  }, [user?.id]);

  async function loadAllCampaigns() {
    try {
      const res = await campaignApi.list();
      setAllCampaigns(res.data || []);
      if (res.data?.length > 0) {
        setActiveCampaign((previous) => previous || res.data[0]);
      }
    } catch (e) {
      console.error('Unable to refresh campaign list:', e);
    }
  }

  function handleSelectCampaign(camp) {
    setActiveCampaign(camp);
    setCurrentView('workspace');
    loadAllCampaigns();
  }

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-main)',
          color: 'var(--text-muted)',
          fontSize: '1rem',
        }}
      >
        Initializing Creator Desk...
      </div>
    );
  }

  // If user is not logged in
  if (!user) {
    if (currentView === 'showcase') {
      return (
        <div style={{ minHeight: '100vh', padding: '2rem', background: 'var(--bg-main)' }}>
          <PublicShowcase onBack={() => setCurrentView('login')} />
        </div>
      );
    }
    return (
      <div>
        <AuthPages />
        <div className="auth-showcase-floating">
          <button className="btn btn-secondary btn-sm" type="button" onClick={() => setCurrentView('showcase')}>
            Explore public showcase →
          </button>
        </div>
      </div>
    );
  }

  // Authenticated Application Views
  return (
    <AppLayout
      currentView={currentView}
      setCurrentView={setCurrentView}
      activeCampaign={activeCampaign}
    >
      {currentView === 'campaigns' && (
        <CampaignBoard onSelectCampaign={handleSelectCampaign} />
      )}

      {currentView === 'workspace' && activeCampaign && (
        <CampaignWorkspace
          campaign={activeCampaign}
          onUpdateCampaign={(updated) => {
            setActiveCampaign(updated);
            loadAllCampaigns();
          }}
        />
      )}

      {currentView === 'inbox' && (
        <ApprovalInbox onSelectCampaign={handleSelectCampaign} />
      )}

      {currentView === 'assistant' && (
        <ProductionAssistant
          activeCampaign={activeCampaign}
          campaigns={allCampaigns}
        />
      )}

      {currentView === 'showcase' && (
        <PublicShowcase onBack={() => setCurrentView('campaigns')} />
      )}
    </AppLayout>
  );
}

export default App;
