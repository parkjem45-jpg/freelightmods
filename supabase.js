// supabase.js — Supabase Client & Storage Helpers
// ===============================================

const SUPABASE_URL = "https://egexyoqnzhaygvcbsdyi.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnZXh5b3FuemhheWd2Y2JzZHlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1MDA1MzIsImV4cCI6MjA5NjA3NjUzMn0.dMtVqxCAu3nD0EBmvIG47Xxq44hyE3zPvYqCYSB2EO8";
const BUCKET = "termux-bucket";

const { createClient } = supabase;
const _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Expose globally so other scripts can use it
window.supabase = _client;

/* ==========================================
   STORAGE HELPERS
   ========================================== */
async function uploadTextFile(content, customFilename = null) {
    const timestamp = Math.floor(Date.now() / 1000);
    const filename = customFilename || `termux_${timestamp}.txt`;
    try {
        const { error } = await _client.storage
            .from(BUCKET)
            .upload(filename, new Blob([content]), { contentType: 'text/plain', upsert: false });
        if (error) throw error;
        const { data: urlData } = _client.storage.from(BUCKET).getPublicUrl(filename);
        return { success: true, url: urlData.publicUrl, filename, path: `${BUCKET}/${filename}` };
    } catch (error) {
        console.error("❌ Upload failed:", error.message);
        return { success: false, error: error.message };
    }
}

async function uploadFile(file, customFilename = null) {
    const timestamp = Math.floor(Date.now() / 1000);
    const filename = customFilename || `${timestamp}_${file.name}`;
    try {
        const { error } = await _client.storage
            .from(BUCKET)
            .upload(filename, file, { contentType: file.type, upsert: false });
        if (error) throw error;
        const { data: urlData } = _client.storage.from(BUCKET).getPublicUrl(filename);
        return { success: true, url: urlData.publicUrl, filename, path: `${BUCKET}/${filename}` };
    } catch (error) {
        console.error("❌ Upload failed:", error.message);
        return { success: false, error: error.message };
    }
}

async function listFiles() {
    try {
        const { data, error } = await _client.storage.from(BUCKET).list();
        if (error) throw error;
        console.log(`📁 Found ${(data || []).length} files`);
        return { success: true, files: data || [] };
    } catch (error) {
        console.error("Failed to list files:", error.message);
        return { success: false, error: error.message };
    }
}

async function quickTest() {
    const content = `Test upload from browser at ${new Date().toISOString()}\nSupabase Storage Test`;
    const result = await uploadTextFile(content);
    if (result.success) {
        alert(`✅ Upload successful!\n\n🔗 URL: ${result.url}`);
    } else {
        alert(`❌ Upload failed: ${result.error}`);
    }
    return result;
}

window.uploadTextFile = uploadTextFile;
window.uploadFile = uploadFile;
window.quickTest = quickTest;
window.listFiles = listFiles;

console.log('[Supabase] Client initialized');