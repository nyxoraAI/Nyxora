const fs = require('fs');

async function createRelease() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.log("No GITHUB_TOKEN found, skipping GitHub Release creation.");
    return;
  }

  const body = `## [1.4.4]\n\n### Fixed\n- Fixed Architecture Workflow diagram rendering issue on NPM by replacing the \`mermaid\` code block with a static SVG image.`;

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
        tag_name: 'v1.4.4',
        name: 'v1.4.4',
        body: body,
        draft: false,
        prerelease: false
      })
    });

    if (res.ok) {
      console.log("GitHub Release v1.4.4 successfully created!");
    } else {
      const errorText = await res.text();
      console.error("Failed to create GitHub Release:", res.status, errorText);
    }
  } catch (err) {
    console.error("Error calling GitHub API:", err);
  }
}

createRelease();
