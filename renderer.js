const canvas = document.getElementById('mapCanvas');
const ctx = canvas.getContext('2d');
const vectorReadout = document.getElementById('vectorReadout');
const statusReadout = document.getElementById('statusReadout');

// 1. Grid Configuration Scaled for 8m x 5m Layout
const gridPixels = 500; 
const widthMeters = 8.0;   // Maximum X boundary
const heightMeters = 5.0;  // Maximum Y boundary <-- UPDATED to 5.0
const maxBoundary = 8.0;   // Maintains crisp aspect ratio alignment
const scale = gridPixels / maxBoundary; 

// Define your 4 physical Base Station corners on the 8m x 5m grid
const bs0 = { x: 0.0, y: 0.0, label: 'BS0 (Master/Pico)' }; 
const bs1 = { x: 8.0, y: 0.0, label: 'BS1 (Anchor 1)' };     
const bs2 = { x: 8.0, y: 5.0, label: 'BS2 (Anchor 2)' };     // <-- UPDATED to 5.0
const bs3 = { x: 0.0, y: 5.0, label: 'BS3 (Anchor 3)' };     // <-- UPDATED to 5.0

// Default historical tracking state
let targetX = 0.0; 
let targetY = 0.0;
let isHardwareLive = false;

// 2. Base Dashboard Drawing Function
function drawDashboard() {
    ctx.clearRect(0, 0, gridPixels, gridPixels);

    // Draw Grid Lines (Iterates up to the max boundary to fill the map space)
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let i = 0; i <= maxBoundary; i++) {
        let pos = i * scale;
        
        // Draw vertical grid lines (X axis steps)
        if (i <= widthMeters) {
            ctx.beginPath(); 
            ctx.moveTo(pos, gridPixels - (heightMeters * scale)); 
            ctx.lineTo(pos, gridPixels); 
            ctx.stroke();
        }
        
        // Draw horizontal grid lines (Y axis steps)
        if (i <= heightMeters) {
            ctx.beginPath(); 
            ctx.moveTo(0, gridPixels - (i * scale)); 
            ctx.lineTo(widthMeters * scale, gridPixels - (i * scale)); 
            ctx.stroke();
        }
    }

    // Draw Base Station Anchors
    drawCircle(bs0.x, bs0.y, bs0.label, '#38bdf8'); // Blue
    drawCircle(bs1.x, bs1.y, bs1.label, '#10b981'); // Green
    drawCircle(bs2.x, bs2.y, bs2.label, '#a855f7'); // Purple
    drawCircle(bs3.x, bs3.y, bs3.label, '#f59e0b'); // Orange

    // Draw Target Dot
    drawCircle(targetX, targetY, 'Target Tag', '#ef4444', true);
    
    // Only overwrite readout text dynamically when hardware actively updates it
    if (isHardwareLive) {
        vectorReadout.innerText = `X: ${targetX.toFixed(2)}m | Y: ${targetY.toFixed(2)}m`;
    }
}

function drawCircle(x, y, label, color, isTarget = false) {
    let canvasX = x * scale;
    let canvasY = gridPixels - (y * scale); // Inverts Y math to match standard cartesian plane

    ctx.beginPath();
    ctx.arc(canvasX, canvasY, isTarget ? 18 : 14, 0, 2 * Math.PI);
    ctx.fillStyle = color + '22';
    ctx.fill();
    if(isTarget) { ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.stroke(); }

    ctx.beginPath();
    ctx.arc(canvasX, canvasY, 6, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();

    ctx.fillStyle = '#64748b';
    ctx.font = '10px sans-serif';
    ctx.fillText(label, canvasX + 12, canvasY - 8);
}

// 3. Hardware Serial Port Link Management
try {
    const { SerialPort } = require('serialport');
    const { ReadlineParser } = require('@serialport/parser-readline');
    
    const PICO_PORT = 'COM8'; 

    const port = new SerialPort({ path: PICO_PORT, baudRate: 115200, autoOpen: true });
    
    port.on('open', () => {
        console.log(`Successfully claimed serial access on channel: ${PICO_PORT}`);
    });

    port.on('error', (err) => {
        console.log("Hardware interface error or port closed. Waiting for link...");
    });

    const parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));
    
    parser.on('data', (line) => {
        const coordinates = line.toString().trim().split(',');
        if (coordinates.length === 2) {
            const parsedX = parseFloat(coordinates[0]);
            const parsedY = parseFloat(coordinates[1]);
            
            if (!isNaN(parsedX) && !isNaN(parsedY)) {
                targetX = parsedX;
                targetY = parsedY;
                
                if (!isHardwareLive) {
                    isHardwareLive = true;
                    statusReadout.innerText = "CONNECTED (REAL DATA)";
                    statusReadout.style.color = "#10b981"; 
                }
                
                drawDashboard();
            }
        }
    });
} catch (e) {
    console.log("System level serial driver failure.");
}

// 4. Continuous Maintenance Clock Loop
setInterval(() => {
    if (!isHardwareLive) {
        statusReadout.innerText = "WAITING FOR PICO LINK...";
        statusReadout.style.color = "#f59e0b"; 
        vectorReadout.innerText = "X: 0.00m | Y: 0.00m";
        drawDashboard();
    }
}, 33);