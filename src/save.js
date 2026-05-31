export function buildCommitFiles(dataB64, newPhotos, cfg) {
  const files = [{ path: cfg.dataPath, contentB64: dataB64 }];
  for (const ph of newPhotos || [])
    files.push({ path: `${cfg.photosDir}/${ph.name}`, contentB64: ph.base64 });
  return files;
}

// Коммитит файлы через GitHub Contents API (по одному PUT).
// token — персональный токен с правом repo (вводится пользователем, не хранится).
export async function commitToGitHub(token, cfg, files, message, fetchImpl = fetch) {
  const [owner, repo] = cfg.repo.split('/');
  for (const f of files) {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${f.path}`;
    // получить sha существующего файла (если есть)
    let sha;
    const head = await fetchImpl(`${url}?ref=${cfg.branch}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (head.ok) sha = (await head.json()).sha;
    const res = await fetchImpl(url, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message, content: f.contentB64, branch: cfg.branch, ...(sha ? { sha } : {})
      })
    });
    if (!res.ok) throw new Error(`GitHub API ${res.status} на ${f.path}`);
  }
}
