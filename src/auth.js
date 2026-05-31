import { signIn, signOut, getSession } from './db.js';

// Вход редактора по общему аккаунту (email+пароль). Бросает при ошибке.
export async function login(email, password) { await signIn(email, password); }
export async function logout() { await signOut(); }
// Есть ли активная сессия (т.е. можно редактировать).
export async function isEditor() { return !!(await getSession()); }
