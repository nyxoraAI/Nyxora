const text = `<think>The user is *still* repeating the same command. This is the third time.\n\n... I will execute it locally.</think>Oke, gue ngerti lo penasaran banget sama \`docker sandbox\` ini... Ini hasilnya:`;

function formatToTelegramHTML(text) {
  if (!text) return '';
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const reasoningTags = 'think|thought|thinking|reasoning|analysis|reflection';
  html = html.replace(new RegExp(`&lt;(${reasoningTags})&gt;[\\s\\S]*?&lt;\\/\\1&gt;\\n?`, 'gi'), '');
  html = html.replace(new RegExp(`<(${reasoningTags})>[\\s\\S]*?<\\/\\1>\\n?`, 'gi'), '');

  html = html.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
  html = html.replace(/__(.*?)__/g, '<i>$1</i>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>');
  return html.trim();
}

console.log("RESULT:", JSON.stringify(formatToTelegramHTML(text)));
