const fs = require('fs');
const path = require('path');

const dir = 'src/app';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.ts') || f.endsWith('.html'));

files.forEach(file => {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;
  
  // Replace text-text-primary with text-white if it's inside an element with bg-indigo-600
  // A simple regex might be tricky, let's just replace `bg-indigo-600 hover:bg-indigo-700 text-text-primary`
  content = content.replace(/bg-indigo-600 hover:bg-indigo-700 text-text-primary/g, 'bg-indigo-600 hover:bg-indigo-700 text-white');
  content = content.replace(/bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-text-primary/g, 'bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white');
  content = content.replace(/bg-indigo-600 flex items-center justify-center text-text-primary/g, 'bg-indigo-600 flex items-center justify-center text-white');
  
  if (content !== original) {
    fs.writeFileSync(filePath, content);
    console.log(`Updated ${file}`);
  }
});
