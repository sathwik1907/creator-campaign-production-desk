import React, { useState, useEffect } from 'react';
import { notify } from '../services/notify';
import { aiApi, taskApi } from '../services/api';
import {
  Bot,
  Sparkles,
  Send,
  AlertTriangle,
  CheckCircle,
  Clock,
  Layers,
  ShieldCheck,
  Check,
  Wrench,
  FileText,
  AlertCircle,
} from 'lucide-react';

export function ProductionAssistant({ activeCampaign, campaigns = [] }) {
  const [selectedCampaignId, setSelectedCampaignId] = useState(
    activeCampaign?._id || (campaigns.length > 0 ? campaigns[0]._id : '')
  );
  const [query, setQuery] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [agentAssessment, setAgentAssessment] = useState(null);
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [tasksApplied, setTasksApplied] = useState(false);
  const [applyingTasks, setApplyingTasks] = useState(false);

  useEffect(() => {
    if (activeCampaign?._id) {
      setSelectedCampaignId(activeCampaign._id);
    }
  }, [activeCampaign]);

  useEffect(() => {
    if (!selectedCampaignId && campaigns.length > 0) setSelectedCampaignId(campaigns[0]._id);
  }, [campaigns, selectedCampaignId]);

  useEffect(() => {
    // Chat IDs, results and recommendations must never mix between campaigns.
    setConversationId(null);
    setChatMessages([]);
    setAgentAssessment(null);
    setTasksApplied(false);
  }, [selectedCampaignId]);

  // Run Feasibility Agent Workflow ("Can we deliver this campaign by Friday?")
  async function handleRunFeasibilityWorkflow(customQuery) {
    if (!selectedCampaignId) {
      notify('Please select a campaign first');
      return;
    }
    setLoading(true);
    setAgentAssessment(null);
    setTasksApplied(false);
    try {
      const q = customQuery || 'Can we deliver this campaign by Friday?';
      const res = await aiApi.runProductionAgent(selectedCampaignId, q);
      setAgentAssessment(res.data);
    } catch (err) {
      notify(err.message || 'Production agent execution failed', 'error');
    } finally {
      setLoading(false);
    }
  }

  // Handle conversational chat message
  async function handleSendMessage(e) {
    e.preventDefault();
    if (!query.trim() || !selectedCampaignId) return;

    const userText = query.trim();
    setQuery('');
    setChatMessages((prev) => [...prev, { role: 'user', content: userText }]);
    setLoading(true);

    try {
      // Check if user is asking the delivery feasibility question
      if (/deliver.*friday|deliverable.*friday|ready.*friday/i.test(userText)) {
        await handleRunFeasibilityWorkflow(userText);
      } else {
        const res = await aiApi.sendChat(selectedCampaignId, userText, conversationId);
        if (res.data?.conversationId) setConversationId(res.data.conversationId);
        setChatMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: res.data.answer,
            citations: res.data.citations,
            assets: res.data.assets,
          },
        ]);
      }
    } catch (err) {
      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Error: ${err.message || 'Could not communicate with assistant.'}` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  // Producer confirms and applies proposed tasks
  async function handleConfirmAndApplyTasks() {
    if (!agentAssessment?.proposedTasks || !selectedCampaignId) return;
    setApplyingTasks(true);
    try {
      await taskApi.batchApplyProposed(selectedCampaignId, agentAssessment.proposedTasks);
      setTasksApplied(true);
      notify('Proposed corrective tasks have been officially confirmed and added to the production schedule!');
    } catch (err) {
      notify(err.message || 'Failed to apply tasks', 'error');
    } finally {
      setApplyingTasks(false);
    }
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      {/* Title & Campaign Selector */}
      <div
        className="glass-card"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--brand-gradient)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              boxShadow: 'var(--shadow-glow)',
            }}
          >
            <Bot size={24} />
          </div>
          <div>
            <h3>AI Production Assistant & Agent</h3>
            <p style={{ fontSize: '0.85rem' }}>
              Multi-tool agent for schedule feasibility, license rights audits, and deliverable compliance.
            </p>
          </div>
        </div>

        {/* Campaign select */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Target Campaign:</span>
          <select
            className="form-control"
            value={selectedCampaignId}
            onChange={(e) => setSelectedCampaignId(e.target.value)}
            style={{ minWidth: '220px' }}
          >
            {campaigns.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name} ({c.clientName})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Demonstration Scenario Quick Trigger Banner */}
      <div
        className="glass-card"
        style={{
          marginBottom: '1.5rem',
          padding: '1rem 1.25rem',
          background: 'rgba(99, 102, 241, 0.08)',
          border: '1px solid rgba(99, 102, 241, 0.3)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Sparkles size={22} color="var(--brand-primary)" />
          <div>
            <div style={{ fontWeight: '600', fontSize: '0.95rem' }}>
              Run Project 04 Feasibility Assessment
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Executes <code>inspectDeliverables</code>, <code>checkAssetRights</code>, and <code>readProductionSchedule</code>.
            </div>
          </div>
        </div>

        <button
          id="btn-run-friday-check"
          className="btn btn-primary"
          onClick={() => handleRunFeasibilityWorkflow('Can we deliver this campaign by Friday?')}
          disabled={loading}
        >
          {loading ? 'Evaluating Tools...' : 'Ask: "Can we deliver this campaign by Friday?"'}
        </button>
      </div>

      {/* FEASIBILITY ASSESSMENT REPORT (When Triggered) */}
      {agentAssessment && (
        <div
          className="glass-card animate-fade-in"
          style={{
            marginBottom: '2rem',
            border: agentAssessment.feasible ? '1px solid var(--color-success)' : '1px solid rgba(239, 68, 68, 0.5)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                <span
                  className={`badge ${agentAssessment.feasible ? 'badge-success' : 'badge-danger'}`}
                  style={{ fontSize: '0.8rem', padding: '0.3rem 0.75rem' }}
                >
                  {agentAssessment.feasible ? 'DELIVERY ON TRACK' : 'DELIVERY AT RISK / CANNOT DELIVER'}
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Evaluated with 3 secured agent tools
                </span>
              </div>
              <h3>Production Feasibility Assessment</h3>
            </div>
          </div>

          {/* Tool Execution Status Badges */}
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
              Executed Agent Tools & Status:
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              {(agentAssessment.toolExecutions || []).map((t, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.35rem 0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    background: t.status === 'SUCCESS' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    border: `1px solid ${t.status === 'SUCCESS' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                    fontSize: '0.8rem',
                  }}
                >
                  <Wrench size={13} color={t.status === 'SUCCESS' ? 'var(--color-success)' : 'var(--color-danger)'} />
                  <code>{t.toolName}</code>
                  <span style={{ fontWeight: '600', color: t.status === 'SUCCESS' ? 'var(--color-success)' : 'var(--color-danger)' }}>
                    [{t.status}]
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* CRITICAL FINDINGS: Expired Assets & Missing Sponsor Text */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
            {/* Blockers */}
            <div
              style={{
                padding: '1rem',
                background: 'var(--color-danger-bg)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--color-danger)', fontWeight: '700', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                <AlertTriangle size={16} /> Critical Blockers Detected ({agentAssessment.blockers?.length || 0}):
              </div>

              {agentAssessment.blockers?.length === 0 ? (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>No critical blockers found.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {agentAssessment.blockers.map((b, i) => (
                    <div key={i} style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                      <strong>• {b.title}:</strong> {b.detail}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Warnings / Schedule */}
            <div
              style={{
                padding: '1rem',
                background: 'var(--color-warning-bg)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--color-warning)', fontWeight: '700', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                <Clock size={16} /> Schedule Risks & Approvals ({agentAssessment.warnings?.length || 0}):
              </div>

              {agentAssessment.warnings?.length === 0 ? (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>No scheduling conflicts.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {agentAssessment.warnings.map((w, i) => (
                    <div key={i} style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                      <strong>• {w.title}:</strong> {w.detail}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Agent Synthesized Explanation */}
          <div style={{ marginBottom: '1.5rem', background: 'var(--bg-input)', padding: '1.25rem', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--brand-primary)', marginBottom: '0.5rem' }}>
              Agent Reasoning & Evidence:
            </div>
            <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--font-sans)', fontSize: '0.85rem', lineHeight: '1.6', color: 'var(--text-primary)' }}>
              {agentAssessment.aiAnswer}
            </pre>
          </div>

          {/* Proposed Corrective Tasks with Explicit Confirmation Control */}
          {agentAssessment.proposedTasks?.length > 0 && (
            <div
              style={{
                padding: '1.25rem',
                background: 'rgba(99, 102, 241, 0.05)',
                border: '1px dashed var(--brand-primary)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <h4 style={{ color: 'var(--text-accent)' }}>AI Proposed Corrective Tasks</h4>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    AI recommendations cannot be executed automatically without explicit Producer confirmation.
                  </span>
                </div>

                {tasksApplied ? (
                  <span className="badge badge-success" style={{ padding: '0.4rem 0.8rem' }}>
                    <Check size={14} /> Confirmed & Added to Schedule
                  </span>
                ) : (
                  <button
                    id="btn-confirm-proposed-tasks"
                    className="btn btn-primary btn-sm"
                    onClick={handleConfirmAndApplyTasks}
                    disabled={applyingTasks}
                  >
                    {applyingTasks ? 'Applying...' : 'Confirm & Apply Tasks to Schedule'}
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {agentAssessment.proposedTasks.map((t, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '0.6rem 0.85rem',
                      background: 'rgba(255, 255, 255, 0.03)',
                      borderRadius: 'var(--radius-sm)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '0.85rem',
                    }}
                  >
                    <div>
                      <strong>{t.title}</strong>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{t.description}</div>
                    </div>
                    <span className="badge badge-warning" style={{ fontSize: '0.65rem' }}>{t.priority}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Campaign Chat Stream */}
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', minHeight: '380px' }}>
        <h4 style={{ marginBottom: '1rem' }}>Campaign Discussion & Q&A</h4>

        <div style={{ flex: 1, overflowY: 'auto', maxHeight: '450px', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {chatMessages.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              Ask anything about campaign requirements, permitted sponsor claims, asset rights, or deadlines.
            </div>
          ) : (
            chatMessages.map((msg, i) => (
              <div
                key={i}
                style={{
                  alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '80%',
                  padding: '0.85rem 1.15rem',
                  borderRadius: 'var(--radius-md)',
                  background: msg.role === 'user' ? 'var(--brand-primary)' : 'var(--bg-input)',
                  color: 'white',
                  fontSize: '0.9rem',
                  lineHeight: '1.5',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <div style={{ fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.25rem', opacity: 0.8 }}>
                  {msg.role === 'user' ? 'You' : 'Production Assistant'}
                </div>
                <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>

                {/* Citations if available */}
                {msg.citations?.length > 0 && (
                  <div style={{ marginTop: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.1)', fontSize: '0.75rem' }}>
                    <div style={{ fontWeight: '600', color: 'var(--text-accent)', marginBottom: '0.2rem' }}>
                      Citations:
                    </div>
                    {msg.citations.map((c, ci) => (
                      <div key={ci} style={{ opacity: 0.85 }}>
                        • {c.briefTitle} (v{c.revision}) - {c.sectionTitle}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            id="input-assistant-query"
            type="text"
            className="form-control"
            placeholder="Type your question or request (e.g. 'What sponsor text must appear in the video?')..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={loading}
          />
          <button id="btn-send-assistant-query" type="submit" className="btn btn-primary" disabled={loading}>
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}
