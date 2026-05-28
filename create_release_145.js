const fs = require('fs');

async function createRelease() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.log("No GITHUB_TOKEN found, skipping GitHub Release creation.");
    return;
  }

  const body = `## [1.4.5]\n\n### Fixed\n- Re-rendered Architecture Workflow diagram as a solid-background PNG to fix dark mode visibility issues.\n- Added \`assets\` directory to the NPM package \`files\` list so the diagram is included in published packages.\n- Added \`repository\` field in \`package.json\` for proper GitHub link resolution on NPMJS.\n- Updated \`README.md\` to use the absolute raw GitHub image URL for universal rendering compatibility.`;

  try {
    const res = await fetch('https://api.github.com/repos/perasyudha/Nyxora/releases', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        tag_name: 'v1.4.5',
        name: 'v1.4.5',
        body: body,
        draft: false,
        prerelease: false
      })
    });

    if (res.ok) {
      console.log("GitHub Release v1.4.5 successfully created!");
    } else {
      const errorText = await res.text();
      console.error("Failed to create GitHub Release:", res.status, errorText);
    }
  } catch (err) {
    console.error("Error calling GitHub API:", err);
  }
}

createRelease();
