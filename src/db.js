import { createClient } from '@supabase/supabase-js';

const URL = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient(URL, KEY);

// Загрузить всё дерево (один блоб) + текущую версию.
export async function loadTree() {
  const { data, error } = await supabase
    .from('tree').select('data, version').eq('id', 1).single();
  if (error) throw error;
  return { data: data.data || { persons: [] }, version: data.version };
}

// Сохранить дерево с оптимистичным локом по version.
// Возвращает {conflict:true} если версия разошлась (ничего не записано).
export async function saveTree(treeData, version) {
  const { data, error } = await supabase
    .from('tree')
    .update({ data: treeData, version: version + 1, updated_at: new Date().toISOString() })
    .eq('id', 1).eq('version', version)
    .select('version');
  if (error) throw error;
  if (!data || data.length === 0) return { conflict: true };
  return { conflict: false, version: data[0].version };
}

// Загрузить фото (Blob) в bucket photos под именем name (перезапись).
export async function uploadPhoto(blob, name) {
  const { error } = await supabase.storage
    .from('photos').upload(name, blob, { upsert: true, contentType: 'image/jpeg' });
  if (error) throw error;
  return name;
}

// Публичный URL фото по имени файла.
export function photoUrl(name) {
  return supabase.storage.from('photos').getPublicUrl(name).data.publicUrl;
}

export async function signIn(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signOut() {
  await supabase.auth.signOut();
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}
