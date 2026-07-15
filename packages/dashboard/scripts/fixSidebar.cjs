const fs = require('fs');
const path = require('path');

const tsxPath = path.resolve(__dirname, '../src/App.tsx');
let content = fs.readFileSync(tsxPath, 'utf8');

// Add imports
if (!content.includes('PanelLeftClose')) {
  content = content.replace(/LayoutDashboard, Key, Server, Sun, Moon/, 'LayoutDashboard, Key, Server, Sun, Moon, PanelLeftClose, PanelLeftOpen');
}

// Add state
if (!content.includes('const [isSidebarCollapsed')) {
  content = content.replace(
    /const \[theme, setTheme\] = useState.*?;/g,
    `$&
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);`
  );
}

// Modify aside tag
content = content.replace(
  /<aside className="sidebar">/g,
  `<aside className={\`sidebar \${isSidebarCollapsed ? 'collapsed' : ''}\`}>`
);

// Add toggle button to agent-identity-card
content = content.replace(
  /<div className="agent-identity-card">/,
  `<div className="agent-identity-card" style={{ position: 'relative' }}>`
);

if (!content.includes('sidebar-toggle-btn')) {
  content = content.replace(
    /<\/div>\s*<\/div>\s*<\/div>\s*<div className="sidebar-scroll-area">/,
    `    </div>
          </div>
          <button 
            className="sidebar-toggle-btn"
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            style={{ 
              position: 'absolute', top: '24px', right: '12px', background: 'transparent', 
              border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' 
            }}
          >
            {isSidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>

        <div className="sidebar-scroll-area">`
  );
}

// Wrap nav text in spans and add title attributes
const navItemsRegex = /<div\s+className=\{?`?nav-item.*?`?\}?\s+onClick=\{.*?\}.*?>\s*<(\w+) size=\{15\} className="nav-icon" \/>\s*(.*?)\s*<\/div>/g;

content = content.replace(navItemsRegex, (match, icon, text) => {
  if (text.includes('nav-label')) return match; // already wrapped
  const cleanText = text.trim();
  return match.replace(
    `<${icon} size={15} className="nav-icon" /> ${cleanText}`,
    `<${icon} size={15} className="nav-icon" /> <span className="nav-label">${cleanText}</span>`
  ).replace(
    /onClick=\{.*?\}/,
    `$& title={isSidebarCollapsed ? "${cleanText}" : undefined}`
  );
});

// also for the sessions
content = content.replace(
  /<span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.85rem' }}>\s*\{session\.title\}\s*<\/span>/g,
  `<span className="nav-label" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.85rem' }}>{session.title}</span>`
);

fs.writeFileSync(tsxPath, content, 'utf8');
console.log("App.tsx updated for sidebar");

// Now update index.css
const cssPath = path.resolve(__dirname, '../src/index.css');
let cssContent = fs.readFileSync(cssPath, 'utf8');

if (!cssContent.includes('.sidebar.collapsed')) {
  cssContent = cssContent.replace(
    /\.sidebar {\s*width: 260px;\s*height: 100vh;/,
    `.sidebar {
  width: 260px;
  height: 100vh;
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);`
  );

  cssContent += `
/* Collapsed Sidebar Styles */
.sidebar.collapsed {
  width: 80px;
}

.sidebar.collapsed .nav-label,
.sidebar.collapsed .agent-info,
.sidebar.collapsed .sidebar-section,
.sidebar.collapsed .delete-session-btn {
  display: none;
  opacity: 0;
}

.sidebar.collapsed .agent-identity-card {
  justify-content: center;
  padding: 24px 0;
}

.sidebar.collapsed .sidebar-toggle-btn {
  position: static !important;
  margin-top: 16px;
}

.sidebar.collapsed .nav-item {
  justify-content: center;
  padding: 12px;
}

.sidebar.collapsed .nav-item .nav-icon {
  margin: 0;
}

.sidebar.collapsed .agent-avatar {
  margin-bottom: 0;
}

/* Make Nyxora logo a bit smaller when collapsed or just hide the text */
`;
  fs.writeFileSync(cssPath, cssContent, 'utf8');
  console.log("index.css updated for sidebar");
}
