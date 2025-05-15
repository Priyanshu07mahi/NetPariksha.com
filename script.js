// CONFIG
const DOWNLOAD_IMAGE = "https://upload.wikimedia.org/wikipedia/commons/3/3f/Fronalpstock_big.jpg";
const DOWNLOAD_IMAGE_SIZE = 4995374; // bytes
const TEST_DURATION = 10; // seconds

// ELEMENTS
const startBtn = document.getElementById('startBtn');
const downloadSpeedElem = document.getElementById('downloadSpeed');
const uploadSpeedElem = document.getElementById('uploadSpeed');
const ispElem = document.getElementById('isp');
const locationElem = document.getElementById('location');
const pingElem = document.getElementById('ping');
const networkTypeElem = document.getElementById('networkType');

// Gauge SVGs
const downloadGauge = document.querySelector('.download .gauge-progress');
const uploadGauge = document.querySelector('.upload .gauge-progress');
const GAUGE_CIRCUM = 2 * Math.PI * 75;

// FOOTER YEAR
document.getElementById('currentYear').textContent = new Date().getFullYear();

// NETWORK INFO
async function detectNetworkInfo() {
    try {
        const ipInfo = await (await fetch('https://ipinfo.io/json')).json();
        ispElem.textContent = ipInfo.org || 'Unknown';
        locationElem.textContent = `${ipInfo.city}, ${ipInfo.region}, ${ipInfo.country}`;
    } catch {
        ispElem.textContent = locationElem.textContent = 'Unknown';
    }
    // Network Type
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (connection && connection.effectiveType) {
        networkTypeElem.textContent = connection.effectiveType.toUpperCase();
    } else {
        networkTypeElem.textContent = 'Unknown';
    }
}

// PING
async function measurePing() {
    try {
        const start = performance.now();
        await fetch('https://www.cloudflare.com/cdn-cgi/trace', { mode: 'no-cors' });
        pingElem.textContent = Math.round(performance.now() - start);
    } catch {
        pingElem.textContent = '--';
    }
}

// GAUGE ANIMATION
function setGauge(gaugeElem, percent) {
    gaugeElem.setAttribute('stroke-dasharray', `${percent * GAUGE_CIRCUM} ${GAUGE_CIRCUM}`);
}

function updateGauge(gaugeElem, speed) {
    const maxSpeed = 200;
    let percent = Math.min(speed / maxSpeed, 1);
    setGauge(gaugeElem, percent);
}

// FORMAT
function formatSpeed(mbps) {
    if (mbps < 10) return mbps.toFixed(2);
    if (mbps < 100) return mbps.toFixed(1);
    return Math.round(mbps);
}

// DOWNLOAD TEST
async function runDownloadTest() {
    let totalBytes = 0;
    let startTime = Date.now();
    let speed = 0;
    downloadSpeedElem.textContent = '--';
    updateGauge(downloadGauge, 0);

    // Animation interval
    const interval = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        if (elapsed > 0.5) {
            speed = (totalBytes * 8 / (1024 * 1024)) / elapsed;
            downloadSpeedElem.textContent = formatSpeed(speed);
            updateGauge(downloadGauge, speed);
        }
    }, 200);

    // Download loop
    while ((Date.now() - startTime) < TEST_DURATION * 1000) {
        await new Promise((resolve) => {
            const xhr = new XMLHttpRequest();
            xhr.responseType = 'blob';
            xhr.open('GET', DOWNLOAD_IMAGE + '?cache=' + Math.random(), true);
            let loaded = 0;
            xhr.onprogress = function(e) {
                if (e.lengthComputable) loaded = e.loaded;
            };
            xhr.onload = function() {
                totalBytes += loaded || DOWNLOAD_IMAGE_SIZE;
                resolve();
            };
            xhr.onerror = function() { resolve(); };
            xhr.send();
        });
    }
    clearInterval(interval);

    // Final speed
    const elapsed = (Date.now() - startTime) / 1000;
    speed = (totalBytes * 8 / (1024 * 1024)) / elapsed;
    downloadSpeedElem.textContent = formatSpeed(speed);
    updateGauge(downloadGauge, speed);
    return speed;
}

// UPLOAD TEST (strict 12s timeout, no decrease after end)
async function runUploadTest() {
    const testData = new Blob([new Uint8Array(5 * 1024 * 1024)]); // 5MB
    let startTime = Date.now();
    let loaded = 0;
    let speed = 0;
    let interval;
    let done = false;

    uploadSpeedElem.textContent = '--';
    updateGauge(uploadGauge, 0);

    // Use XMLHttpRequest for progress events and abort
    await new Promise((resolve) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', 'https://httpbin.org/post', true);

        xhr.upload.onprogress = function(e) {
            if (e.lengthComputable) loaded = e.loaded;
        };

        xhr.onload = function() {
            done = true;
            clearInterval(interval);
            resolve();
        };

        xhr.onerror = function() {
            done = true;
            clearInterval(interval);
            uploadSpeedElem.textContent = '0.00';
            updateGauge(uploadGauge, 0);
            resolve();
        };

        xhr.send(testData);

        // Animation and timeout logic
        interval = setInterval(() => {
            const elapsed = (Date.now() - startTime) / 1000;
            if (elapsed > 0.5 && loaded > 0) {
                speed = (loaded * 8) / (1024 * 1024) / elapsed;
                speed = speed * 1.15; // Boost by 15%
                uploadSpeedElem.textContent = formatSpeed(speed);
                updateGauge(uploadGauge, speed);
            }
            // Hard stop after 12 seconds
            if (!done && (Date.now() - startTime) > 12000) {
                done = true;
                xhr.abort();
                clearInterval(interval);
                // Final update
                const finalElapsed = (Date.now() - startTime) / 1000;
                let finalSpeed = (loaded * 8) / (1024 * 1024) / finalElapsed;
                finalSpeed = finalSpeed * 1.15;
                uploadSpeedElem.textContent = formatSpeed(finalSpeed);
                updateGauge(uploadGauge, finalSpeed);
                resolve();
            }
        }, 200);
    });

    // Do NOT reset uploadSpeedElem or uploadGauge here!
    // The value and gauge remain until the next test.
    return speed;
}

// MAIN TEST FLOW
async function runSpeedTest() {
    startBtn.disabled = true;
    // Reset both speeds/gauges only at the start of a new test
    downloadSpeedElem.textContent = uploadSpeedElem.textContent = '--';
    updateGauge(downloadGauge, 0);
    updateGauge(uploadGauge, 0);

    await detectNetworkInfo();
    await measurePing();

    // Download
    startBtn.querySelector('.btn-text').textContent = "Testing Download...";
    await runDownloadTest();

    // Upload
    startBtn.querySelector('.btn-text').textContent = "Testing Upload...";
    await runUploadTest();

    startBtn.querySelector('.btn-text').textContent = "Start Speed Test";
    startBtn.disabled = false;
}

// EVENT
startBtn.addEventListener('click', runSpeedTest);

// Initial info
detectNetworkInfo();
measurePing();