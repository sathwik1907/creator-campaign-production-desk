import React from 'react';
import { useAuth } from '../context/AuthContext';
import { ToastCenter } from '../components/ToastCenter';
import {
  LayoutGrid, FolderOpen, WandSparkles, ClipboardCheck, Globe2,
  LogOut, ChevronRight, ChevronDown, BriefcaseBusiness, ShieldCheck,
  PanelLeftClose, Menu, X, ArrowUpRight,
} from 'lucide-react';

const routes = [
  { view: 'campaigns', label: 'Overview', icon: LayoutGrid },
  { view: 'workspace', label: 'Campaign workspace', icon: FolderOpen, needsCampaign: true },
  { view: 'inbox', label: 'Approval inbox', icon: ClipboardCheck },
  { view: 'assistant', label: 'Production assistant', icon: WandSparkles },
];

const titles = {
  campaigns: 'Overview', workspace: 'Campaign workspace', inbox: 'Approval inbox',
  assistant: 'Production assistant', showcase: 'Public showcase',
};

export function AppLayout({ currentView, setCurrentView, activeCampaign, children }) {
  const { user, workspace, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  function navigate(view) {
    setCurrentView(view);
    setMobileMenuOpen(false);
  }

  return (
    <div className="app-container">
      {mobileMenuOpen && <button className="sidebar-scrim" aria-label="Close menu" onClick={() => setMobileMenuOpen(false)} />}
      <aside className={`app-sidebar ${mobileMenuOpen ? 'sidebar-open' : ''}`} aria-label="Primary navigation">
        <div className="brand-row">
          <div className="brand-mark" aria-hidden="true"><span>c</span><span className="brand-dot">.</span></div>
          <div className="brand-copy"><strong>creator<span>desk</span></strong><small>Production suite</small></div>
          <button className="mobile-close icon-button" aria-label="Close navigation" onClick={() => setMobileMenuOpen(false)}><X size={19} /></button>
        </div>

        <div className="workspace-switcher" title={workspace?.name || 'Your workspace'}>
          <div className="workspace-icon"><BriefcaseBusiness size={17} /></div>
          <div className="workspace-switcher-copy"><small>WORKSPACE</small><strong>{workspace?.name || 'Personal workspace'}</strong></div>
          <ChevronDown size={15} className="workspace-chevron" />
        </div>

        <div className="sidebar-section-label">GENERAL</div>
        <nav className="sidebar-nav">
          {routes.filter((r) => !r.needsCampaign || activeCampaign).map(({ view, label, icon: Icon }) => (
            <button key={view} id={`nav-${view}`} type="button" aria-current={currentView === view ? 'page' : undefined}
              className={`sidebar-link ${currentView === view ? 'active' : ''}`} onClick={() => navigate(view)}>
              <Icon size={18} strokeWidth={1.9} /> <span>{label}</span>
              {currentView === view && <ChevronRight className="sidebar-current-arrow" size={14} />}
            </button>
          ))}
        </nav>

        <div className="sidebar-section-label sidebar-section-secondary">SHARING</div>
        <nav className="sidebar-nav">
          <button id="nav-showcase" type="button" aria-current={currentView === 'showcase' ? 'page' : undefined}
            className={`sidebar-link ${currentView === 'showcase' ? 'active' : ''}`} onClick={() => navigate('showcase')}>
            <Globe2 size={18} strokeWidth={1.9} /><span>Public showcase</span>
            <ArrowUpRight className="sidebar-current-arrow" size={14} />
          </button>
        </nav>

        <div className="sidebar-spacer" />
        <div className="sidebar-footer-note"><ShieldCheck size={16} /><span>Private, role-based workspace</span></div>
        <div className="sidebar-profile">
          <div className="profile-avatar">{user?.name?.trim()?.[0]?.toUpperCase() || 'U'}</div>
          <div className="profile-info"><strong>{user?.name || 'Team member'}</strong><small>{user?.email}</small></div>
          <button id="btn-logout" type="button" className="icon-button logout-button" onClick={logout} aria-label="Sign out" title="Sign out"><LogOut size={18} /></button>
        </div>
      </aside>

      <div className="main-content">
        <header className="page-header">
          <div className="topbar-leading">
            <button className="icon-button mobile-menu-button" onClick={() => setMobileMenuOpen(true)} aria-label="Open navigation"><Menu size={20} /></button>
            <span className="topbar-workspace-name">{workspace?.name || 'Workspace'}</span>
            <ChevronRight size={15} className="topbar-chevron" />
            <span className="topbar-current">{titles[currentView]}</span>
          </div>
          <div className="topbar-trailing">
            {currentView === 'workspace' && activeCampaign && <span className="header-campaign-name">{activeCampaign.name}</span>}
            {activeCampaign?.userRole && <span className="role-pill"><ShieldCheck size={14} /> {activeCampaign.userRole.toLowerCase()}</span>}
            <div className="topbar-avatar" title={user?.name}>{user?.name?.trim()?.[0]?.toUpperCase() || 'U'}</div>
          </div>
        </header>
        <main className="page-body" id="main-content">{children}</main>
        <ToastCenter />
        <footer className="app-footer"><span>Creator Desk © {new Date().getFullYear()}</span><span>Built for thoughtful production teams.</span></footer>
      </div>
    </div>
  );
}
