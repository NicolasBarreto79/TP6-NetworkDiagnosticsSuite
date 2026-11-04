import React from 'react';
import Svg, { Path, Circle, Rect, Line, Polyline } from 'react-native-svg';

export interface IconProps {
  size?: number;
  color?: string;
}

export function RadarLanIcon({ size = 20, color = '#0284C7' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.8" />
      <Circle cx="12" cy="12" r="5" stroke={color} strokeWidth="1.5" strokeDasharray="3 2" />
      <Circle cx="12" cy="12" r="1.8" fill={color} />
      <Line x1="12" y1="12" x2="18.2" y2="5.8" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

export function TerminalProtocolIcon({ size = 20, color = '#0284C7' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="2.5" y="4" width="19" height="16" rx="2.5" stroke={color} strokeWidth="1.8" />
      <Polyline points="7,9.5 10.5,12.5 7,15.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <Line x1="12.5" y1="15.5" x2="17" y2="15.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

export function QrReportIcon({ size = 20, color = '#0284C7' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="3" width="7" height="7" rx="1" stroke={color} strokeWidth="1.8" />
      <Rect x="14" y="3" width="7" height="7" rx="1" stroke={color} strokeWidth="1.8" />
      <Rect x="3" y="14" width="7" height="7" rx="1" stroke={color} strokeWidth="1.8" />
      <Path d="M14 14h3v3h-3zM18 18h3v3h-3zM14 19h2v2h-2zM19 14h2v2h-2z" fill={color} />
    </Svg>
  );
}

export function HistoryClockIcon({ size = 20, color = '#0284C7' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.8" />
      <Polyline points="12,7 12,12 15.5,14" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function OutboxCloudSyncIcon({ size = 20, color = '#0284C7' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6.5 18.5H18a4 4 0 0 0 .5-7.97A5.5 5.5 0 0 0 7.7 8.6 4.5 4.5 0 0 0 6.5 18.5Z"
        stroke={color}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <Polyline points="10,13.5 12,11.5 14,13.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <Line x1="12" y1="11.5" x2="12" y2="16.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

export function ShieldLockIcon({ size = 16, color = '#0284C7' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3l7 3v5c0 5-3.2 8.7-7 10-3.8-1.3-7-5-7-10V6l7-3z"
        stroke={color}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <Circle cx="12" cy="11.5" r="1.5" fill={color} />
    </Svg>
  );
}

