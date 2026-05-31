// Публичный конфиг. ВНИМАНИЕ: репа публичная — пароль здесь слабая защита.
export const CONFIG = {
  repo: 'USER/REPO',          // заполнить при деплое: owner/repo
  branch: 'main',
  dataPath: 'data.json',
  photosDir: 'photos',
  // base64 от пароля (UTF-8). Сгенерировать: btoa(unescape(encodeURIComponent('пароль')))
  passwordB64: 'cGFzc3dvcmQ='  // 'password' — заменить
};
