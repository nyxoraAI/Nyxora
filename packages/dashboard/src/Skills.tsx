import { apiFetch } from './utils/api';
import React, { useState, useEffect } from 'react';
import { Compass } from 'lucide-react';

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

const formatSkillName = (name: string) => {
  return name
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

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
                  {formatSkillName(skill.function.name)}
                </h3>
              </div>
              <span className="badge" style={{ background: 'rgba(34, 197, 94, 0.2)', color: '#4ade80' }}>Active</span>
            </div>
            
            <div style={{ padding: '16px 0', flex: 1 }}>
              <p style={{ color: '#d1d5db', fontSize: '0.9rem', lineHeight: '1.5' }}>
                {skill.function.description}
              </p>
            </div>


          </div>
        ))}
      </div>
    </div>
  );
};

export default Skills;
