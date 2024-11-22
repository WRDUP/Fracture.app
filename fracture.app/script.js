// Core variables
let windows = [];
let draggedElement = null;
let dragOffset = { x: 0, y: 0 };
let isResizing = false;
let currentWindow = null;
let activeSocket = null;
let connections = new Map();
let cables = new Map();
let windowIndex = 1000;

// Window content generator
function getWindowContent(type) {
    switch(type) {
        case 'patchbay':
            return `
                <div class="patchbay-content">
                    <div class="patchbay-section">
                        <div class="section-title">Inventory</div>
                        <div class="socket-container">
                            <div class="patchbay-socket" data-socket="inv-1"></div>
                            <span>Item Display</span>
                        </div>
                        <div class="socket-container">
                            <div class="patchbay-socket" data-socket="inv-2"></div>
                            <span>Item Properties</span>
                        </div>
                    </div>
                    
                    <div class="patchbay-section">
                        <div class="section-title">Visualizer</div>
                        <div class="socket-container">
                            <div class="patchbay-socket" data-socket="vis-1"></div>
                            <span>Input</span>
                        </div>
                        <div class="socket-container">
                            <div class="patchbay-socket" data-socket="vis-2"></div>
                            <span>Modulation</span>
                        </div>
                    </div>
                    
                    <div class="patchbay-section">
                        <div class="section-title">Music Player</div>
                        <div class="socket-container">
                            <div class="patchbay-socket" data-socket="music-1"></div>
                            <span>Audio Output</span>
                        </div>
                        <div class="socket-container">
                            <div class="patchbay-socket" data-socket="music-2"></div>
                            <span>Frequency Data</span>
                        </div>
                    </div>
                </div>
                <svg class="cable-layer"></svg>
            `;
        case 'music':
            return `
                <div class="music-player">
                    <div>Now Playing</div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: 30%;"></div>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span>1:24</span>
                        <span>4:32</span>
                    </div>
                </div>
            `;
        case 'visualizer':
            return `
                <div class="visualizer-content">
                    <div class="visualizer-bars">
                        ${Array(12).fill(0).map((_, i) => 
                            `<div class="visualizer-bar" style="animation-delay: ${i * 0.1}s;"></div>`
                        ).join('')}
                    </div>
                </div>
            `;
        case 'profile':
            return `
                <div class="profile-card">
                    <div style="display: flex; align-items: center;">
                        <div class="profile-avatar">ID</div>
                        <div class="profile-info">
                            <div>Universal Profile</div>
                            <div class="profile-address">0x1234...5678</div>
                        </div>
                    </div>
                </div>
            `;
        default:
            return `<div class="default-content" style="padding: 15px;">
                <div style="opacity: 0.7;">${type.charAt(0).toUpperCase() + type.slice(1)} Window</div>
            </div>`;
    }
}
// Window creation and management
function createWindow(type) {
    const windowCount = windows.length;
    const window = document.createElement('div');
    window.className = 'window';
    window.dataset.type = type;
    window.style.left = `${80 + (windowCount * 30)}px`;
    window.style.top = `${20 + (windowCount * 30)}px`;
    window.style.zIndex = windowIndex++;
    
    window.innerHTML = `
        <div class="corner corner-tl"></div>
        <div class="corner corner-tr"></div>
        <div class="corner corner-bl"></div>
        <div class="corner corner-br"></div>
        <div class="window-content">
            <div class="window-header">
                <span class="window-title">${type.charAt(0).toUpperCase() + type.slice(1)}</span>
                <div class="window-buttons">
                    <button class="window-button toggle-transparent">T</button>
                    <button class="window-button close">×</button>
                </div>
            </div>
            ${getWindowContent(type)}
        </div>
        <div class="resize-handle"></div>
    `;

    document.body.appendChild(window);
    windows.push(window);

    requestAnimationFrame(() => {
        window.classList.add('visible');
        setupWindowEvents(window);
        if (type === 'patchbay') {
            initializePatchbay(window);
        }
    });

    return window;
}

function setupWindowEvents(window) {
    window.addEventListener('mousedown', (e) => {
        if (e.target.closest('.window-button')) return;
        
        window.style.zIndex = windowIndex++;
        
        if (e.target.closest('.resize-handle')) {
            isResizing = true;
            currentWindow = window;
            return;
        }

        if (!e.target.closest('.patchbay-socket')) {
            draggedElement = window;
            window.classList.add('dragging');
            const rect = window.getBoundingClientRect();
            dragOffset = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };
        }
    });

    window.querySelector('.toggle-transparent').addEventListener('click', () => {
        window.classList.toggle('transparent');
    });

    window.querySelector('.close').addEventListener('click', () => {
        window.classList.remove('visible');
        setTimeout(() => {
            if (window.querySelector('.patchbay-socket')) {
                cleanupPatchbayConnections(window);
            }
            window.remove();
            windows = windows.filter(w => w !== window);
        }, 200);
    });
}
// Patchbay initialization and handling
function initializePatchbay(window) {
    const sockets = window.querySelectorAll('.patchbay-socket');
    const cableLayer = window.querySelector('.cable-layer');

    sockets.forEach(socket => {
        socket.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            handleSocketClick(socket, window);
        });
    });

    window.addEventListener('mousemove', (e) => {
        if (activeSocket && activeSocket.closest('.window') === window) {
            requestAnimationFrame(() => updateTempCable(e, window));
        }
    });
}

function handleSocketClick(socket, window) {
    if (activeSocket === socket) {
        activeSocket = null;
        removeTempCable(window);
        return;
    }

    if (activeSocket) {
        if (activeSocket !== socket && 
            activeSocket.closest('.window') === window &&
            activeSocket.dataset.socket !== socket.dataset.socket) {
            createConnection(activeSocket, socket);
        }
        activeSocket = null;
        removeTempCable(window);
    } else {
        activeSocket = socket;
    }
}

function createConnection(socket1, socket2) {
    const id = `${socket1.dataset.socket}-${socket2.dataset.socket}`;
    if (connections.has(id)) return;

    const window = socket1.closest('.window');
    const svgNamespace = "http://www.w3.org/2000/svg";
    const cable = document.createElementNS(svgNamespace, "path");
    cable.classList.add('cable');

    updateCablePath(cable, socket1, socket2);
    window.querySelector('.cable-layer').appendChild(cable);

    connections.set(id, { from: socket1, to: socket2, cable });
    socket1.classList.add('connected');
    socket2.classList.add('connected');
    
    cables.set(id, cable);
}

function updateCablePath(cable, socket1, socket2) {
    const rect1 = socket1.getBoundingClientRect();
    const rect2 = socket2.getBoundingClientRect();
    const windowRect = socket1.closest('.window').getBoundingClientRect();

    const x1 = rect1.left + rect1.width/2 - windowRect.left;
    const y1 = rect1.top + rect1.height/2 - windowRect.top;
    const x2 = rect2.left + rect2.width/2 - windowRect.left;
    const y2 = rect2.top + rect2.height/2 - windowRect.top;

    // Calculate control points for a smooth curve
    const dx = x2 - x1;
    const dy = y2 - y1;
    const cx1 = x1 + dx * 0.25;
    const cy1 = y1;
    const cx2 = x2 - dx * 0.25;
    const cy2 = y2;

    cable.setAttribute('d', `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`);
}

function updateTempCable(e, window) {
    const rect = activeSocket.getBoundingClientRect();
    const windowRect = window.getBoundingClientRect();

    const x1 = rect.left + rect.width/2 - windowRect.left;
    const y1 = rect.top + rect.height/2 - windowRect.top;
    const x2 = e.clientX - windowRect.left;
    const y2 = e.clientY - windowRect.top;

    let tempCable = window.querySelector('.temp-cable');
    if (!tempCable) {
        const svgNamespace = "http://www.w3.org/2000/svg";
        tempCable = document.createElementNS(svgNamespace, "path");
        tempCable.classList.add('cable', 'temp-cable');
        window.querySelector('.cable-layer').appendChild(tempCable);
    }

    const dx = x2 - x1;
    const cx1 = x1 + dx * 0.25;
    const cx2 = x2 - dx * 0.25;

    tempCable.setAttribute('d', `M ${x1} ${y1} C ${cx1} ${y1}, ${cx2} ${y2}, ${x2} ${y2}`);
}

function removeTempCable(window) {
    const tempCable = window.querySelector('.temp-cable');
    if (tempCable) tempCable.remove();
}

function updateAllCables(window) {
    connections.forEach((conn, id) => {
        if (conn.from.closest('.window') === window || 
            conn.to.closest('.window') === window) {
            const cable = cables.get(id);
            if (cable) {
                updateCablePath(cable, conn.from, conn.to);
            }
        }
    });
}

function cleanupPatchbayConnections(window) {
    const socketsToRemove = window.querySelectorAll('.patchbay-socket');
    socketsToRemove.forEach(socket => {
        connections.forEach((conn, id) => {
            if (conn.from === socket || conn.to === socket) {
                const cable = cables.get(id);
                if (cable) cable.remove();
                cables.delete(id);
                connections.delete(id);
                
                if (conn.from !== socket) conn.from.classList.remove('connected');
                if (conn.to !== socket) conn.to.classList.remove('connected');
            }
        });
    });
}
// Drag and resize handlers
function handleDrag(e) {
    if (!draggedElement) return;

    requestAnimationFrame(() => {
        const gridSize = 20;
        const newX = Math.round((e.clientX - dragOffset.x) / gridSize) * gridSize;
        const newY = Math.round((e.clientY - dragOffset.y) / gridSize) * gridSize;

        draggedElement.style.transform = `translate3d(${newX}px, ${newY}px, 0)`;

        if (draggedElement.querySelector('.patchbay-socket')) {
            updateAllCables(draggedElement);
        }
    });
}

function handleResize(e) {
    if (!isResizing || !currentWindow) return;

    requestAnimationFrame(() => {
        const rect = currentWindow.getBoundingClientRect();
        const width = Math.max(200, e.clientX - rect.left);
        const height = Math.max(150, e.clientY - rect.top);
        
        currentWindow.style.width = `${width}px`;
        currentWindow.style.height = `${height}px`;

        if (currentWindow.querySelector('.patchbay-socket')) {
            updateAllCables(currentWindow);
        }
    });
}

// Layout saving and loading
function saveLayout() {
    const layout = {
        windows: windows.map(window => ({
            type: window.dataset.type,
            position: {
                left: window.style.left,
                top: window.style.top
            },
            size: {
                width: window.style.width,
                height: window.style.height
            },
            isTransparent: window.classList.contains('transparent'),
            zIndex: window.style.zIndex
        })),
        connections: Array.from(connections.entries()).map(([id, conn]) => ({
            id,
            from: conn.from.dataset.socket,
            to: conn.to.dataset.socket
        }))
    };
    localStorage.setItem('dashboardLayout', JSON.stringify(layout));
}

// Event listeners
document.addEventListener('mousemove', e => {
    handleDrag(e);
    handleResize(e);
}, { passive: true });

document.addEventListener('mouseup', () => {
    if (draggedElement) {
        const transform = draggedElement.style.transform;
        const x = transform.match(/translate3d\((.+?)px/)?.[1] || '0';
        const y = transform.match(/translate3d\(.+?,\s*(.+?)px/)?.[1] || '0';
        draggedElement.style.left = `${x}px`;
        draggedElement.style.top = `${y}px`;
        draggedElement.style.transform = '';
        draggedElement.classList.remove('dragging');
    }
    draggedElement = null;
    isResizing = false;
    currentWindow = null;
});

// Load saved layout on startup
const savedLayout = localStorage.getItem('dashboardLayout');
if (savedLayout) {
    const layout = JSON.parse(savedLayout);
    layout.windows.forEach(windowData => {
        const window = createWindow(windowData.type);
        window.style.left = windowData.position.left;
        window.style.top = windowData.position.top;
        if (windowData.size.width) window.style.width = windowData.size.width;
        if (windowData.size.height) window.style.height = windowData.size.height;
        if (windowData.isTransparent) window.classList.add('transparent');
        if (windowData.zIndex) window.style.zIndex = windowData.zIndex;
    });

    // Restore connections after a brief delay to ensure windows are ready
    setTimeout(() => {
        layout.connections?.forEach(conn => {
            const from = document.querySelector(`[data-socket="${conn.from}"]`);
            const to = document.querySelector(`[data-socket="${conn.to}"]`);
            if (from && to) {
                createConnection(from, to);
            }
        });
    }, 300);
}