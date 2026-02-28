const fs = require('fs');
const path = require('path');

function generateTree(dir, prefix = '') {
    let result = '';
    let items;
    try {
        items = fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
        return '';
    }
    
    items.sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
    });

    const filtered = items.filter(item => !['node_modules', '.git', 'dist', 'dist-app'].includes(item.name));

    filtered.forEach((item, index) => {
        const isLast = index === filtered.length - 1;
        const pointer = isLast ? '└── ' : '├── ';
        const icon = item.isDirectory() ? '📁 ' : '📄 ';
        result += `${prefix}${pointer}${icon}${item.name}\n`;
        if (item.isDirectory()) {
            const nextPrefix = prefix + (isLast ? '    ' : '│   ');
            result += generateTree(path.join(dir, item.name), nextPrefix);
        }
    });
    return result;
}

const tree = 'e:\\team\n' + generateTree('E:\\team');
fs.writeFileSync('E:\\team\\full_tree_temp.txt', tree, 'utf8');
