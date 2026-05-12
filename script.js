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

    
    'text-background-color': '#6a5acd', // violet
    'text-background-opacity': 1,
    'text-background-padding': '4px',
    'text-background-shape': 'roundrectangle',

    'color': '#ffffff', // text alb
    'font-size': '16px',
    'text-outline-width': 0,

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
        if (!line.trim()) return;
        const [u, v, w] = line.split(/\s+/).map(Number);
        if ([u, v, w].some(isNaN)) return;
        edges.push({ u, v, w });
        nodesSet.add(u);
        nodesSet.add(v);
    });

    return { edges, nodes: [...nodesSet] };
}


// ================= FIXED POSITIONS STORE =================
let fixedPositions = {};


// ================= FORCE-BASED LAYOUT =================
// Places nodes using a simple force simulation to minimize edge crossings
function computePositions(nodes, edges) {
    const W = cy.width()  || 600;
    const H = cy.height() || 400;
    const cx = W / 2, cy_ = H / 2;
    const n = nodes.length;
    const pos = {};

    // Initial placement: golden-angle spiral so nodes start spread out
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    nodes.forEach((id, i) => {
        const r = 0.38 * Math.min(W, H) * Math.sqrt((i + 0.5) / n);
        const a = i * goldenAngle;
        pos[id] = { x: cx + r * Math.cos(a), y: cy_ + r * Math.sin(a) };
    });

    // Build adjacency for degree
    const deg = {};
    nodes.forEach(n => deg[n] = 0);
    edges.forEach(e => { deg[e.u]++; deg[e.v]++; });

    // Force-directed iterations
    const ITER     = 300;
    const k        = Math.sqrt((W * H) / (n + 1)) * 1.2;  // ideal spring length
    const REPULSE  = k * k;
    const COOL     = 0.96;
    let temp       = Math.min(W, H) * 0.25;

    for (let iter = 0; iter < ITER; iter++) {
        const disp = {};
        nodes.forEach(id => disp[id] = { x: 0, y: 0 });

        // Repulsion between every pair
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const a = nodes[i], b = nodes[j];
                const dx = pos[a].x - pos[b].x;
                const dy = pos[a].y - pos[b].y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
                const force = REPULSE / dist;
                disp[a].x += (dx / dist) * force;
                disp[a].y += (dy / dist) * force;
                disp[b].x -= (dx / dist) * force;
                disp[b].y -= (dy / dist) * force;
            }
        }

        // Attraction along edges
        edges.forEach(e => {
            const dx = pos[e.u].x - pos[e.v].x;
            const dy = pos[e.u].y - pos[e.v].y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
            const force = (dist * dist) / k;
            disp[e.u].x -= (dx / dist) * force;
            disp[e.u].y -= (dy / dist) * force;
            disp[e.v].x += (dx / dist) * force;
            disp[e.v].y += (dy / dist) * force;
        });

        // Apply with temperature clamping + boundary padding
        const PAD = 50;
        nodes.forEach(id => {
            const d    = disp[id];
            const mag  = Math.sqrt(d.x * d.x + d.y * d.y) || 0.01;
            const step = Math.min(mag, temp);
            pos[id].x  = Math.max(PAD, Math.min(W - PAD, pos[id].x + (d.x / mag) * step));
            pos[id].y  = Math.max(PAD, Math.min(H - PAD, pos[id].y + (d.y / mag) * step));
        });

        temp *= COOL;
    }

    return pos;
}


// ================= DRAW =================
function drawGraph(nodes, edges) {
    cy.elements().remove();
    fixedPositions = {};

    const pos = computePositions(nodes, edges);

    nodes.forEach(n => {
        cy.add({
            data: { id: n.toString() },
            position: { x: pos[n].x, y: pos[n].y }
        });
    });

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

    // Lock positions so nodes never move during/after animation
    cy.nodes().forEach(node => {
        fixedPositions[node.id()] = { ...node.position() };
        node.lock();
    });

    cy.fit(cy.elements(), 50);
}


// ================= SHOW TIMING =================
function showTiming(ms) {
    const box = document.getElementById('timing');
    const val = document.getElementById('timing-value');
    val.textContent = ms < 1 ? '< 1 ms' : `${ms} ms`;
    box.style.display = 'flex';
}


// ================= CLEAN NON-MST =================
async function removeNonMSTEdges() {
    const edges = cy.edges();

    edges.forEach(e => {
        if (!e.hasClass("edge-mst")) {
            e.animate({ style: { opacity: 0 } }, { duration: 400 });
        }
    });

    await sleep(450);

    edges.forEach(e => {
        if (!e.hasClass("edge-mst")) e.remove();
    });

    // Nodurile raman exact pe pozitiile lor — fara relayout
}


// ================= KRUSKAL =================
async function runKruskal() {
    const data = parseInput();
    if (!data) return;

    const { nodes, edges } = data;
    drawGraph(nodes, edges);

    // Sortăm muchiile după greutate
    edges.sort((a, b) => a.w - b.w);

    // Inițializare Union-Find
    let parent = {};
    nodes.forEach(n => parent[n] = n);

    function find(x) {
        if (parent[x] !== x) {
            parent[x] = find(parent[x]); // path compression
        }
        return parent[x];
    }

    function unite(a, b) {
        parent[find(a)] = find(b);
    }

    let totalWeight = 0;
    let mstEdges = 0;
    let output = "KRUSKAL:\n";

    const t0 = performance.now();

    for (let e of edges) {

        // 🔴 OPRIRE când avem n-1 muchii
        if (mstEdges === nodes.length - 1) break;

        let edge = cy.getElementById(getEdgeId(e.u, e.v));

        edge.addClass("edge-active");
        await sleep(100);

        if (find(e.u) !== find(e.v)) {
            unite(e.u, e.v);

            edge.removeClass("edge-active");
            edge.addClass("edge-mst");

            totalWeight += e.w;
            mstEdges++;

            output += `✔ ${e.u} — ${e.v} (greutate: ${e.w})\n`;
        } else {
            edge.removeClass("edge-active");
            output += `✘ ${e.u} — ${e.v} (ciclu)\n`;
        }
    }

    const t1 = performance.now();

    output += `\nGreutate totală MST: ${totalWeight}`;
    document.getElementById("output").textContent = output;
    showTiming(Math.round(t1 - t0));

    await removeNonMSTEdges();
}


// ================= PRIM =================
async function runPrim() {
    const data = parseInput();
    if (!data) return;

    let { nodes, edges } = data;
    drawGraph(nodes, edges);

    let visited = new Set([nodes[0]]);
    let output = "PRIM:\n";
    let totalWeight = 0;

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
        await sleep(100);

        edge.removeClass("edge-active");
        edge.addClass("edge-mst");

        visited.add(minEdge.u);
        visited.add(minEdge.v);
        totalWeight += minEdge.w;

        output += `✔ ${minEdge.u} — ${minEdge.v}  (greutate: ${minEdge.w})\n`;
    }

    const t1 = performance.now();

    output += `\nGreutate totală MST: ${totalWeight}`;
    document.getElementById("output").textContent = output;
    showTiming(Math.round(t1 - t0));

    await removeNonMSTEdges();
}



const presets = {
  1: `1 2 2
1 5 5
2 3 3
3 5 4
2 4 7
3 6 8
4 6 6
5 6 12
6 7 9`,

  2: `1 2 4
  1 8 8
  2 8 11
  2 3 8
  8 9 7
  8 7 1
  3 9 2
  7 9 6
  3 4 7
  3 6 4
  7 6 2
  4 6 14
  4 5 9
  6 5 10`,

  3: `1 2 3
  1 6 6
  1 5 4
  2 5 3
  2 6 2
  2 4 1
  4 5 3
  4 6 5
  4 7 4
  4 8 2
  8 7 1
  8 3 2
  7 6 5
  7 3 3
  3 6 4
  5 6 1`,

  4: `1 2 1
  1 4 4
  2 4 6
  2 5 4
  2 3 2
  3 5 5
  3 6 6
  4 5 3
  4 7 4
  5 6 8
  5 7 7
  6 7 3`,

  5: `1 2 3
  1 5 5
  1 6 9
  2 6 3
  2 5 1
  2 3 3
  3 5 2
  3 4 6
  6 5 1
  5 4 7`,

  6: `1 2 9
  1 3 1
  1 4 3
  1 7 9
  2 5 4
  3 5 2
  3 6 5
  5 6 1
  6 7 1
  6 8 4
  4 7 5
  4 8 1
  7 8 2`
};

function loadPreset(n) {
  document.getElementById("inputGraph").value = presets[n];
  drawGraph(); // dacă ai funcția asta
}

// mstEdges = lista muchiilor din MST
cy.edges().forEach(edge => {
  const u = edge.data('source');
  const v = edge.data('target');

  const inMST = mstEdges.some(e =>
    (e.u == u && e.v == v) || (e.u == v && e.v == u)
  );

  if (!inMST) {
    edge.style('opacity', 0.1); // sau 0 dacă vrei să dispară complet
  } else {
    edge.style('line-color', 'green');
    edge.style('width', 4);
  }
});
