const fs = require('fs');
const path = './index.css';
let css = fs.readFileSync(path, 'utf8');

// Update dark mode header
css = css.replace(
  '.agent-trace-header {\n  display: flex;',
  '.agent-trace-header {\n  display: flex;\n  background: rgba(255, 255, 255, 0.03);\n  border: 1px solid rgba(255, 255, 255, 0.05);'
);

// Update dark mode summary
css = css.replace(
  '.agent-trace-summary {\n  font-weight: 500;',
  '.agent-trace-summary {\n  font-weight: 500;\n  color: #cbd5e1;'
);

// Update dark mode body
css = css.replace(
  'border-left: 1px solid rgba(255, 255, 255, 0.1);',
  'border-left: 2px solid rgba(255, 255, 255, 0.1);'
);

// Add agent-trace-icon to dark mode
if (!css.includes('.agent-trace-icon {')) {
  css = css.replace(
    '.agent-trace-chevron {',
    '.agent-trace-icon {\n  color: #94a3b8;\n}\n\n.agent-trace-chevron {'
  );
}

// Update light mode header
css = css.replace(
  'body.light-theme .agent-trace-header {\n  color: #1f2937;\n}',
  'body.light-theme .agent-trace-header {\n  color: #1f2937;\n  background: rgba(0, 0, 0, 0.03);\n  border: 1px solid rgba(0, 0, 0, 0.1);\n}'
);

// Update light mode body
css = css.replace(
  'body.light-theme .agent-trace-body {\n  border-left: 1px solid rgba(0, 0, 0, 0.1);\n}',
  'body.light-theme .agent-trace-body {\n  border-left: 2px solid rgba(0, 0, 0, 0.15);\n}'
);

// Add light mode summary & icon
if (!css.includes('body.light-theme .agent-trace-summary')) {
  css = css.replace(
    'body.light-theme .agent-trace-header:hover {',
    'body.light-theme .agent-trace-summary {\n  color: #4b5563;\n}\n\nbody.light-theme .agent-trace-icon {\n  color: #6b7280;\n}\n\nbody.light-theme .agent-trace-header:hover {'
  );
}

fs.writeFileSync(path, css);
