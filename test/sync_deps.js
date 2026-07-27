const fs = require('fs');
const path = require('path');

const rootPkgPath = path.join(process.cwd(), 'package.json');
const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8'));

const packagesDir = path.join(process.cwd(), 'packages');
const packages = fs.readdirSync(packagesDir);

for (const pkg of packages) {
  const pkgPath = path.join(packagesDir, pkg, 'package.json');
  if (fs.existsSync(pkgPath)) {
    const pkgJson = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    if (pkgJson.dependencies) {
      for (const [dep, version] of Object.entries(pkgJson.dependencies)) {
        if (!rootPkg.dependencies[dep] && !rootPkg.devDependencies[dep] && !dep.startsWith('@nyxora/')) {
          console.log(`Adding ${dep}@${version} to root package.json`);
          rootPkg.dependencies[dep] = version;
        }
      }
    }
  }
}

// sort dependencies alphabetically
const sortedDeps = {};
Object.keys(rootPkg.dependencies).sort().forEach(key => {
  sortedDeps[key] = rootPkg.dependencies[key];
});
rootPkg.dependencies = sortedDeps;

fs.writeFileSync(rootPkgPath, JSON.stringify(rootPkg, null, 2) + '\n');
console.log('Done!');
