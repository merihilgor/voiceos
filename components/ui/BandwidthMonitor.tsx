import React, { useState, useEffect } from 'react';

interface BandwidthMonitorProps {
    visible?: boolean;
}

// Speed thresholds in Mbps
const DOWNLOAD_GREEN_MBPS = 50;
const DOWNLOAD_ORANGE_MBPS = 200;
const DOWNLOAD_MAX_MBPS = 1000;
const UPLOAD_GREEN_MBPS = 10;
const UPLOAD_ORANGE_MBPS = 100;
const UPLOAD_MAX_MBPS = 500;

const bytesToMbps = (bytes: number): number => (bytes * 8) / (1024 * 1024);

// Speedometer-style Gauge
const SpeedometerGauge: React.FC<{
    value: number;
    max: number;
    greenEnd: number;
    orangeEnd: number;
    label: string;
}> = ({ value, max, greenEnd, orangeEnd, label }) => {
    const size = 90;
    const strokeWidth = 12;
    const radius = (size - strokeWidth) / 2;
    const cx = size / 2;
    const cy = size / 2 + 5;

    // Semi-circle arc (180 degrees, from -180 to 0)
    const startAngle = 180;
    const endAngle = 0;
    const totalSweep = 180;

    const angleFromValue = (v: number) => {
        const ratio = Math.min(v / max, 1);
        return startAngle - ratio * totalSweep;
    };

    const circumference = Math.PI * radius;
    const greenPercent = greenEnd / max;
    const orangePercent = (orangeEnd - greenEnd) / max;
    const redPercent = (max - orangeEnd) / max;

    const valueAngle = angleFromValue(value);
    const needleLength = radius - 8;
    const needleRad = (valueAngle * Math.PI) / 180;
    const needleX = cx + needleLength * Math.cos(needleRad);
    const needleY = cy - needleLength * Math.sin(needleRad);

    const displayValue = value >= 1000 ? `${(value / 1000).toFixed(1)}` : value.toFixed(0);
    const unit = value >= 1000 ? 'Gbps' : 'Mbps';

    const getNeedleColor = () => {
        if (value <= greenEnd) return '#10b981';
        if (value <= orangeEnd) return '#f59e0b';
        return '#ef4444';
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <svg width={size} height={size * 0.6} viewBox={`0 0 ${size} ${size * 0.7}`}>
                {/* Background track */}
                <path
                    d={`M ${strokeWidth / 2} ${cy} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${cy}`}
                    fill="none"
                    stroke="#1f2937"
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                />

                {/* Green zone */}
                <path
                    d={`M ${strokeWidth / 2} ${cy} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${cy}`}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth={strokeWidth}
                    strokeLinecap="butt"
                    strokeDasharray={`${circumference * greenPercent} ${circumference}`}
                    strokeDashoffset={0}
                />

                {/* Orange zone */}
                <path
                    d={`M ${strokeWidth / 2} ${cy} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${cy}`}
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth={strokeWidth}
                    strokeLinecap="butt"
                    strokeDasharray={`${circumference * orangePercent} ${circumference}`}
                    strokeDashoffset={-circumference * greenPercent}
                />

                {/* Red zone */}
                <path
                    d={`M ${strokeWidth / 2} ${cy} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${cy}`}
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth={strokeWidth}
                    strokeLinecap="butt"
                    strokeDasharray={`${circumference * redPercent} ${circumference}`}
                    strokeDashoffset={-circumference * (greenPercent + orangePercent)}
                />

                {/* Needle */}
                <line
                    x1={cx}
                    y1={cy}
                    x2={needleX}
                    y2={needleY}
                    stroke={getNeedleColor()}
                    strokeWidth={3}
                    strokeLinecap="round"
                />
                <circle cx={cx} cy={cy} r={5} fill={getNeedleColor()} />

                {/* Labels */}
                <text x={strokeWidth / 2 + 4} y={cy + 14} fill="#6b7280" fontSize="8" textAnchor="start">0</text>
                <text x={size - strokeWidth / 2 - 4} y={cy + 14} fill="#6b7280" fontSize="8" textAnchor="end">
                    {max >= 1000 ? `${max / 1000}G` : max}
                </text>
            </svg>

            {/* Value display */}
            <div style={{ marginTop: -8, textAlign: 'center' }}>
                <span style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: getNeedleColor(),
                    fontFamily: 'system-ui'
                }}>
                    {displayValue}
                </span>
                <span style={{ fontSize: 10, color: '#9ca3af', marginLeft: 2 }}>{unit}</span>
            </div>
            <span style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>{label}</span>
        </div>
    );
};

export const BandwidthMonitor: React.FC<BandwidthMonitorProps> = ({ visible = true }) => {
    const [downloadMbps, setDownloadMbps] = useState(0);
    const [uploadMbps, setUploadMbps] = useState(0);

    useEffect(() => {
        if (!visible) return;

        let downloadBytes = 0;
        let uploadBytes = 0;
        let lastUpdate = Date.now();

        const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                const resource = entry as PerformanceResourceTiming;
                if (resource.transferSize) downloadBytes += resource.transferSize;
                if (resource.encodedBodySize) uploadBytes += resource.encodedBodySize;
            }
        });

        try {
            observer.observe({ entryTypes: ['resource'] });
        } catch (e) {
            console.warn('PerformanceObserver not supported');
        }

        const interval = setInterval(() => {
            const elapsed = (Date.now() - lastUpdate) / 1000;
            if (elapsed > 0) {
                setDownloadMbps(bytesToMbps(downloadBytes / elapsed));
                setUploadMbps(bytesToMbps(uploadBytes / elapsed));
                downloadBytes = 0;
                uploadBytes = 0;
                lastUpdate = Date.now();
            }
        }, 1000);

        return () => {
            observer.disconnect();
            clearInterval(interval);
        };
    }, [visible]);

    if (!visible) return null;

    return (
        <div
            style={{
                position: 'fixed',
                bottom: 16,
                left: 16,
                background: 'linear-gradient(145deg, rgba(17,24,39,0.98), rgba(31,41,55,0.95))',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(75,85,99,0.3)',
                borderRadius: 16,
                padding: '16px 20px 12px',
                zIndex: 9999,
                display: 'flex',
                gap: 20,
                boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
            }}
        >
            <SpeedometerGauge
                value={downloadMbps}
                max={DOWNLOAD_MAX_MBPS}
                greenEnd={DOWNLOAD_GREEN_MBPS}
                orangeEnd={DOWNLOAD_ORANGE_MBPS}
                label="↓ Download"
            />
            <SpeedometerGauge
                value={uploadMbps}
                max={UPLOAD_MAX_MBPS}
                greenEnd={UPLOAD_GREEN_MBPS}
                orangeEnd={UPLOAD_ORANGE_MBPS}
                label="↑ Upload"
            />
        </div>
    );
};

export default BandwidthMonitor;
