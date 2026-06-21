const fs = require('fs');
const path = require('path');

const tsxPath = path.resolve(__dirname, '../src/App.tsx');
let content = fs.readFileSync(tsxPath, 'utf8');

// Add import
if (!content.includes('import SearchChat')) {
  content = content.replace(
    /import DefiKeys from '\.\/DefiKeys';/,
    `import DefiKeys from './DefiKeys';\nimport SearchChat from './SearchChat';`
  );
}

// Add 'search' to currentView union type
if (!content.includes("| 'search'>")) {
  content = content.replace(
    /useState<'chat' \| 'overview' \| 'portfolio' \| 'settings' \| 'skills' \| 'osskills' \| 'defikeys' \| 'rpcconfig'>/g,
    `useState<'chat' | 'overview' | 'portfolio' | 'settings' | 'skills' | 'osskills' | 'defikeys' | 'rpcconfig' | 'search'>`
  );
}

// Add nav item right below "New Chat"
if (!content.includes('setCurrentView(\'search\')')) {
  content = content.replace(
    /(<Plus size=\{15\} className="nav-icon" \/> <span className="nav-label">New Chat<\/span>\s*<\/div>)/,
    `$1\n            <div \n              className={\`nav-item \${currentView === 'search' ? 'active' : ''}\`}\n              onClick={() => setCurrentView('search')}\n              title={isSidebarCollapsed ? "Search Chat" : undefined}\n            >\n              <Search size={15} className="nav-icon" /> <span className="nav-label">Search Chat</span>\n            </div>`
  );
}

// Add the rendering logic for currentView === 'search'
if (!content.includes('<SearchChat')) {
  content = content.replace(
    /(<Overview config=\{config\} sessionsCount=\{chatSessions\.length\} \/>\s*\) : )/,
    `currentView === 'search' ? (\n          <SearchChat chatSessions={chatSessions} onSelectSession={(id) => { setActiveSessionId(id); setCurrentView('chat'); }} />\n        ) : $1`
  );
}

// Optional: fix the "header title" logic
if (!content.includes('currentView === \'search\' ? \'Search Chat\' :')) {
  content = content.replace(
    /(currentView === 'osskills' \? 'OS Skills' :)/,
    `currentView === 'search' ? 'Search Chat' :\n               $1`
  );
}

fs.writeFileSync(tsxPath, content, 'utf8');
console.log("App.tsx updated for SearchChat");
