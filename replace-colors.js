const fs = require('fs');
const path = require('path');

const dir = 'src/app';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.ts') || f.endsWith('.html'));

const replacements = [
  { regex: /bg-\[#141620\]/g, replacement: 'bg-bg-card' },
  { regex: /bg-\[#0f111a\]\/50/g, replacement: 'bg-bg-main' },
  { regex: /bg-\[#0f111a\]/g, replacement: 'bg-bg-input' },
  { regex: /border-\[#1e2130\]/g, replacement: 'border-border-subtle' },
  { regex: /border-\[#2a2d3d\]/g, replacement: 'border-border-subtle' },
  { regex: /divide-\[#1e2130\]/g, replacement: 'divide-border-subtle' },
  { regex: /hover:bg-\[#1e2130\]\/50/g, replacement: 'hover:bg-bg-hover' },
  { regex: /hover:bg-\[#1e2130\]\/30/g, replacement: 'hover:bg-bg-hover' },
  { regex: /hover:bg-\[#1e2130\]/g, replacement: 'hover:bg-bg-hover' },
  { regex: /hover:bg-\[#2a2d3d\]/g, replacement: 'hover:bg-bg-hover' },
  { regex: /bg-\[#1e2130\]/g, replacement: 'bg-bg-hover' },
  { regex: /text-white/g, replacement: 'text-text-primary' },
  { regex: /text-neutral-300/g, replacement: 'text-text-primary' },
  { regex: /text-neutral-400/g, replacement: 'text-text-secondary' },
  { regex: /text-neutral-500/g, replacement: 'text-text-secondary' },
  { regex: /text-neutral-600/g, replacement: 'text-text-secondary' },
];

files.forEach(file => {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;
  
  replacements.forEach(({ regex, replacement }) => {
    content = content.replace(regex, replacement);
  });
  
  if (content !== original) {
    fs.writeFileSync(filePath, content);
    console.log(`Updated ${file}`);
  }
});
