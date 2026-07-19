import React from 'react';
import { renderToString } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

try {
  const html = renderToString(React.createElement(ReactMarkdown, { remarkPlugins: [remarkGfm] }, "Hello **world**"));
  console.log("SUCCESS:", html);
} catch (e) {
  console.error("ERROR:", e);
}
