const OTAGO_SUPABASE_URL = "https://vzxbowressaxrjjqnist.supabase.co";
const OTAGO_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6eGJvd3Jlc3NheHJqanFuaXN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0NzI1MTYsImV4cCI6MjA5NTA0ODUxNn0.ytKd7Kf7CMkrCK7nG6BfIxj8Yl4J_nuvAY4eDki1HGg";

window.OtagoSharedStore = (() => {
  const table = "app_state";
  const eventLogKey = "otago-event-log-v1";
  const client =
    window.supabase?.createClient?.(OTAGO_SUPABASE_URL, OTAGO_SUPABASE_ANON_KEY) ||
    null;

  async function load(key) {
    if (!client) return { data: null, found: false };

    const { data, error } = await client
      .from(table)
      .select("data, updated_at")
      .eq("key", key)
      .maybeSingle();

    if (error) throw error;
    return {
      data: data?.data ?? null,
      found: Boolean(data),
      updatedAt: data?.updated_at ?? "",
    };
  }

  async function save(key, value) {
    if (!client) return false;

    const { error } = await client.from(table).upsert({
      key,
      data: value ?? {},
      updated_at: new Date().toISOString(),
    });

    if (error) throw error;
    return true;
  }

  function eventId() {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function localEventLog() {
    try {
      return JSON.parse(localStorage.getItem(eventLogKey)) || { events: [] };
    } catch {
      return { events: [] };
    }
  }

  function cacheEventLog(payload) {
    try {
      localStorage.setItem(eventLogKey, JSON.stringify(payload));
    } catch {
      // Local cache is best-effort only.
    }
  }

  async function logEvent(event) {
    const entry = {
      id: eventId(),
      createdAt: new Date().toISOString(),
      source: "Otago Roster",
      ...event,
    };
    const current = client ? await load(eventLogKey) : { data: localEventLog(), found: true };
    const payload = current.data || { events: [] };
    const next = {
      events: [entry, ...(payload.events || [])].slice(0, 800),
    };

    cacheEventLog(next);
    if (client) await save(eventLogKey, next);
    window.dispatchEvent(new CustomEvent("otago-event-log-updated", { detail: entry }));
    return entry;
  }

  return {
    eventLogKey,
    isReady: Boolean(client),
    logEvent,
    load,
    save,
  };
})();
