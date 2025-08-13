const API_BASE = import.meta.env?.VITE_API_BASE || 'http://localhost:4000';
let CLUSTER;
export function setCluster(key) {
    CLUSTER = key || undefined;
    try {
        console.debug('[api] setCluster ->', CLUSTER);
    }
    catch { }
}
export async function getClusters() {
    const r = await fetch(`${API_BASE}/api/clusters`);
    if (!r.ok)
        throw new Error(`clusters ${r.status}`);
    return r.json();
}
function qsWithCluster(params = {}) {
    const merged = { ...params };
    if (CLUSTER)
        merged.cluster = CLUSTER;
    const qs = new URLSearchParams(merged).toString();
    try {
        console.debug('[api] qsWithCluster', { CLUSTER, merged, qs });
    }
    catch { }
    return qs ? `?${qs}` : '';
}
export async function getRtt() {
    const qs = qsWithCluster();
    const r = await fetch(`${API_BASE}/api/rtt${qs}`);
    if (!r.ok)
        throw new Error(`rtt ${r.status}`);
    return r.json();
}
export async function getVarz(params = {}) {
    const qs = qsWithCluster(params);
    const r = await fetch(`${API_BASE}/api/monitor/varz${qs}`);
    if (!r.ok)
        throw new Error(`varz ${r.status}`);
    return r.json();
}
export async function getConnz(params = {}) {
    const qs = qsWithCluster(params);
    const r = await fetch(`${API_BASE}/api/monitor/connz${qs}`);
    if (!r.ok)
        throw new Error(`connz ${r.status}`);
    return r.json();
}
export async function jsInfo() {
    const qs = qsWithCluster();
    const r = await fetch(`${API_BASE}/api/js/info${qs}`);
    if (!r.ok)
        throw new Error(`js/info ${r.status}`);
    return r.json();
}
export async function jsStreams() {
    const qs = qsWithCluster();
    const r = await fetch(`${API_BASE}/api/js/streams${qs}`);
    if (!r.ok)
        throw new Error(`js/streams ${r.status}`);
    return r.json();
}
export async function jsStreamInfo(name) {
    const qs = qsWithCluster();
    const r = await fetch(`${API_BASE}/api/js/streams/${encodeURIComponent(name)}${qs}`);
    if (!r.ok)
        throw new Error(`js/streams/${name} ${r.status}`);
    return r.json();
}
export async function jsConsumers(stream) {
    const qs = qsWithCluster();
    const r = await fetch(`${API_BASE}/api/js/consumers/${encodeURIComponent(stream)}${qs}`);
    if (!r.ok)
        throw new Error(`js/consumers/${stream} ${r.status}`);
    return r.json();
}
export async function jsConsumerInfo(stream, name) {
    const qs = qsWithCluster();
    const r = await fetch(`${API_BASE}/api/js/consumers/${encodeURIComponent(stream)}/${encodeURIComponent(name)}${qs}`);
    if (!r.ok)
        throw new Error(`js/consumers/${stream}/${name} ${r.status}`);
    return r.json();
}
export async function publish(subject, data) {
    const qs = qsWithCluster();
    const r = await fetch(`${API_BASE}/api/publish${qs}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, data })
    });
    if (!r.ok)
        throw new Error(`publish ${r.status}`);
    return r.json();
}
export function subscribe(subject, onMessage) {
    const baseParams = { subject };
    const qs = qsWithCluster(baseParams);
    const url = `${API_BASE}/api/subscribe${qs}`;
    const ev = new EventSource(url);
    const handler = (e) => {
        try {
            const obj = JSON.parse(e.data);
            onMessage(obj);
        }
        catch (err) {
            // ignore
        }
    };
    ev.addEventListener('message', handler);
    ev.onerror = () => {
        // auto-close on error
        ev.close();
    };
    return () => ev.close();
}
// Cluster and additional monitoring endpoints
export async function getRoutez(params = {}) {
    const qs = qsWithCluster(params);
    const r = await fetch(`${API_BASE}/api/monitor/routez${qs}`);
    if (!r.ok)
        throw new Error(`routez ${r.status}`);
    return r.json();
}
export async function getGatewayz(params = {}) {
    const qs = qsWithCluster(params);
    const r = await fetch(`${API_BASE}/api/monitor/gatewayz${qs}`);
    if (!r.ok)
        throw new Error(`gatewayz ${r.status}`);
    return r.json();
}
export async function getLeafz(params = {}) {
    const qs = qsWithCluster(params);
    const r = await fetch(`${API_BASE}/api/monitor/leafz${qs}`);
    if (!r.ok)
        throw new Error(`leafz ${r.status}`);
    return r.json();
}
export async function getSubsz(params = {}) {
    const qs = qsWithCluster(params);
    const r = await fetch(`${API_BASE}/api/monitor/subsz${qs}`);
    if (!r.ok)
        throw new Error(`subsz ${r.status}`);
    return r.json();
}
export async function getAccountz(params = {}) {
    const qs = qsWithCluster(params);
    const r = await fetch(`${API_BASE}/api/monitor/accountz${qs}`);
    if (!r.ok)
        throw new Error(`accountz ${r.status}`);
    return r.json();
}
export async function getAccstatz(params = {}) {
    const qs = qsWithCluster(params);
    const r = await fetch(`${API_BASE}/api/monitor/accstatz${qs}`);
    if (!r.ok)
        throw new Error(`accstatz ${r.status}`);
    return r.json();
}
export async function getJsz(params = {}) {
    const qs = qsWithCluster(params);
    const r = await fetch(`${API_BASE}/api/monitor/jsz${qs}`);
    if (!r.ok)
        throw new Error(`jsz ${r.status}`);
    return r.json();
}
