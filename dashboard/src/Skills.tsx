import { apiFetch } from './utils/api';
import React, { useState, useEffect } from 'react';
import { Compass, Code } from 'lucide-react';

interface SkillParam {
  type: string;
  description?: string;
  enum?: string[];
}

interface SkillDefinition {
  type: string;
  function: {
    name: string;
    description: string;
    parameters: {
      type: string;
      properties: Record<string, SkillParam>;
      required: string[];
    };
  };
}

const Skills: React.FC = () => {
  const [skills, setSkills] = useState<SkillDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSkills = async () => {
      try {
        const res = await apiFetch('http://localhost:3000/api/skills');
        if (res.ok) setSkills(await res.json());
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSkills();
  }, []);

  if (isLoading) return <div className="overview-container">Loading skills...</div>;

  return (
    <div className="overview-container">
      <div className="overview-header">
        <h1>Web3 Capabilities</h1>
        <p>Explore the autonomous on-chain functions currently loaded into the Agent's neural network.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px' }}>
        {skills.map((skill, idx) => (
          <div key={idx} className="panel" style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Compass size={18} color="#3b82f6" />
                <h3 style={{ margin: 0, fontFamily: 'monospace', fontSize: '1.1rem', color: '#60a5fa' }}>
                  {skill.function.name}
                </h3>
              </div>
              <span className="badge" style={{ background: 'rgba(34, 197, 94, 0.2)', color: '#4ade80' }}>Active</span>
            </div>
            
            <div style={{ padding: '16px 0', flex: 1 }}>
              <p style={{ color: '#d1d5db', fontSize: '0.9rem', lineHeight: '1.5' }}>
                {skill.function.description}
              </p>
            </div>

            <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '6px', padding: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', color: '#9ca3af', fontSize: '0.8rem', textTransform: 'uppercase' }}>
                <Code size={12} />
                <span>Parameters Schema</span>
              </div>
              <pre style={{ 
                margin: 0, 
                fontFamily: 'Consolas, Monaco, monospace', 
                fontSize: '0.75rem', 
                color: '#a3a3a3',
                overflowX: 'auto',
                whiteSpace: 'pre-wrap'
              }}>
                {JSON.stringify(skill.function.parameters.properties, null, 2)}
              </pre>
              {skill.function.parameters.required && skill.function.parameters.required.length > 0 && (
                <div style={{ marginTop: '8px', fontSize: '0.75rem', color: '#ef4444' }}>
                  <strong>Required:</strong> {skill.function.parameters.required.join(', ')}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Skills;
