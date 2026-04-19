
// ================= INIT =================
const cy = cytoscape({
    container: document.getElementById('cy'),
    style: [
        {
            selector: 'node',
            style: {
                'label': 'data(id)',
                'background-color': '#4040cc',
                'color': '#fff',
                'text-valign': 'center',
                'text-halign': 'center',
                'font-weight': 'bold',
                'font-size': '13px',
                'width': 36,
                'height': 36
            }
        },
        {
            selector: 'edge',
            style: {
                'label': 'data(weight)',
                'text-background-color': '#6a5acd',
                'text-background-opacity': 1,
                'text-background-padding': '4px',
                'text-background-shape': 'roundrectangle',
                'color': '#ffffff',
                'font-size': '14px',
                'curve-style': 'bezier',
                'width': 2,
                'line-color': '#555'
            }
        },
        {
            selector: '.edge-active',
            style: {
                'line-color': '#f59e0b',
                'width': 4
            }
        },
        {
            selector: '.edge-mst',
            style: {
                'line-color': '#22c55e',
                'width': 5
            }
        }
    ]
});
// ================= UTIL =================
const sleep = ms => new Promise(r => setTimeout(r, ms));
const getEdgeId = (u, v) =>
    `${Math.min(u, v)}-${Math.max(u, v)}`;
// ================= PARSE =================
function parseInput() {
    const text = document.getElementById("inputGraph").value.trim();
    if (!text) return null;
    const edges = [];
    const nodesSet = new Set();
    text.split("\n").forEach(line => {
        const [u, v, w] = line.split(/\s+/).map(Number);
        if ([u, v, w].some(isNaN)) return;
        edges.push({ u, v, w });
        nodesSet.add(u);
        nodesSet.add(v);
    });
    return { edges, nodes: [...nodesSet] };
}
// ================= DRAW (FIXED) =================
function drawGraph(nodes, edges) {
    cy.elements().remove();
    // Adăugăm noduri
    nodes.forEach(n => {
        cy.add({ data: { id: n.toString() } });
    });
    // Adăugăm muchii
    edges.forEach(e => {
        cy.add({
            data: {
                id: getEdgeId(e.u, e.v),
                source: e.u.toString(),
                target: e.v.toString(),
                weight: e.w
            }
        });
    });
    // 🔥 Layout PROFESIONAL
    let layout = cy.layout({
        name: 'cose-bilkent', // dacă nu ai extensia, schimbă în 'cose'
        animate: false,
        fit: true,
        padding: 50,
        idealEdgeLength: 100,
        nodeRepulsion: 4500,
        edgeElasticity: 0.45,
        gravity: 0.25
    });
    layout.run();
    // Blocăm pozițiile după layout
    cy.nodes().forEach(node => node.lock());
}
// ================= TIMING =================
function showTiming(ms) {
    const box = document.getElementById('timing');
    const val = document.getElementById('timing-value');
    val.textContent = ms < 1 ? '< 1 ms' : `${ms} ms`;
    box.style.display = 'flex';
}
// ================= CLEAN =================
async function fadeNonMSTEdges() {
    cy.edges().forEach(e => {
        if (!e.hasClass("edge-mst")) {
            e.animate({ style: { opacity: 0.1 } }, { duration: 400 });
        }
    });
}
// ================= KRUSKAL =================
async function runKruskal() {
    const data = parseInput();
    if (!data) return;
    const { nodes, edges } = data;
    drawGraph(nodes, edges);
    let mstEdges = [];
    edges.sort((a, b) => a.w - b.w);
    let parent = {};
    nodes.forEach(n => parent[n] = n);
    function find(x) {
        if (parent[x] !== x) parent[x] = find(parent[x]);
        return parent[x];
    }
    function unite(a, b) {
        parent[find(a)] = find(b);
    }
    let totalWeight = 0;
    let output = "KRUSKAL:\n";
    const t0 = performance.now();
    for (let e of edges) {
        if (mstEdges.length === nodes.length - 1) break;
        let edge = cy.getElementById(getEdgeId(e.u, e.v));
        edge.addClass("edge-active");
        await sleep(80);
        if (find(e.u) !== find(e.v)) {
            unite(e.u, e.v);
            edge.removeClass("edge-active");
            edge.addClass("edge-mst");
            mstEdges.push(e);
            totalWeight += e.w;
            output += `✔ ${e.u} — ${e.v} (${e.w})\n`;
        } else {
            edge.removeClass("edge-active");
            output += `✘ ${e.u} — ${e.v} (ciclu)\n`;
        }
    }
    const t1 = performance.now();
    output += `\nGreutate totală: ${totalWeight}`;
    document.getElementById("output").textContent = output;
    showTiming(Math.round(t1 - t0));
    await fadeNonMSTEdges();
}
// ================= PRIM =================
async function runPrim() {
    const data = parseInput();
    if (!data) return;
    let { nodes, edges } = data;
    drawGraph(nodes, edges);
    let mstEdges = [];
    let visited = new Set([nodes[0]]);
    let totalWeight = 0;
    let output = "PRIM:\n";
    const t0 = performance.now();
    while (visited.size < nodes.length) {
        let minEdge = null;
        for (let e of edges) {
            let valid =
                (visited.has(e.u) && !visited.has(e.v)) ||
                (visited.has(e.v) && !visited.has(e.u));
            if (valid && (!minEdge || e.w < minEdge.w)) {
                minEdge = e;
            }
        }
        if (!minEdge) break;
        let edge = cy.getElementById(getEdgeId(minEdge.u, minEdge.v));
        edge.addClass("edge-active");
        await sleep(80);
        edge.removeClass("edge-active");
        edge.addClass("edge-mst");
        mstEdges.push(minEdge);
        visited.add(minEdge.u);
        visited.add(minEdge.v);
        totalWeight += minEdge.w;
        output += `✔ ${minEdge.u} — ${minEdge.v} (${minEdge.w})\n`;
    }
    const t1 = performance.now();
    output += `\nGreutate totală: ${totalWeight}`;
    document.getElementById("output").textContent = output;
    showTiming(Math.round(t1 - t0));
    await fadeNonMSTEdges();
}
// ================= PRESETS =================
const presets = {
    1: `1 2 1
1 3 2
2 3 3
3 4 4`,
    2: `1 2 5
1 3 1
2 4 2
3 4 3
4 5 4`,
    3: `1 2 10
2 3 15
3 4 20
4 5 25
5 1 30`,
    4: `1 2 2
1 3 3
1 4 1
2 5 4
3 6 5
4 7 6`,
    5: `1 2 7
2 3 8
3 4 5
4 5 6
5 6 9
6 1 3`,
    6: `1 2 1
1 3 4
2 3 2
2 4 7
3 5 3
4 5 6`
};
function loadPreset(n) {
    document.getElementById("inputGraph").value = presets[n];
