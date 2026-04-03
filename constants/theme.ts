const sharedTheme = {
  spacing: {
    xs: 6,
    sm: 10,
    md: 14,
    lg: 18,
    xl: 24
  },
  radius: {
    sm: 10,
    md: 14,
    lg: 18,
    xl: 22
  },
  font: {
    regular: 'DMSans_400Regular',
    medium: 'DMSans_500Medium',
    semiBold: 'DMSans_500Medium',
    bold: 'DMSans_700Bold',
    mono: 'JetBrainsMono_400Regular',
    monoMedium: 'JetBrainsMono_500Medium'
  },
  type: {
    bodySm: {
      fontSize: 12,
      lineHeight: 16,
      fontFamily: 'DMSans_500Medium' as const
    },
    bodyMd: {
      fontSize: 14,
      lineHeight: 20,
      fontFamily: 'DMSans_500Medium' as const
    },
    bodyLg: {
      fontSize: 16,
      lineHeight: 22,
      fontFamily: 'DMSans_500Medium' as const
    },
    sectionTitle: {
      fontSize: 18,
      fontFamily: 'DMSans_700Bold' as const
    },
    cardLabel: {
      fontSize: 12,
      fontFamily: 'DMSans_500Medium' as const
    },
    cardValue: {
      fontSize: 24,
      fontFamily: 'JetBrainsMono_400Regular' as const
    }
  },
  touch: {
    minTarget: 44
  },
  chart: {
    palette: {
      temperature: '#ef4444',
      voltage: '#22c55e',
      current: '#f59e0b',
      rssi: '#14b8a6',
      cpu: '#38bdf8',
      imu: '#a78bfa',
      uptime: '#facc15'
    },
    strokeWidth: {
      normal: 2.5,
      emphasized: 2.8
    },
    fillOpacity: {
      start: 0.5,
      end: 0.0
    }
  }
};

export const darkTheme = {
  ...sharedTheme,
  colors: {
    background: '#111111',
    card: '#1a1a1a',
    surfaceMuted: '#202020',
    surfaceAlt: '#202020',
    surfaceRaised: '#202020',
    primary: '#e8542a',
    primaryLight: '#ff6b3d',
    muted: '#555555',
    textSoft: '#888888',
    text: '#f0f0f0',
    border: '#2a2a2a',
    success: '#3ddc84',
    warning: '#F59E0B',
    danger: '#e84040',
    info: '#38BDF8',
    logBg: '#111111'
  },
  accents: {
    primary: 'rgba(232,84,42,0.12)',
    success: 'rgba(61,220,132,0.12)',
    warning: 'rgba(249,115,22,0.12)',
    neutral: '#202020'
  },
  shadow: {
    card: {
      shadowColor: '#000',
      shadowOpacity: 0.2,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 3
    },
    floating: {
      shadowColor: '#000',
      shadowOpacity: 0.4,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 8
    }
  }
} as const;

export const lightTheme = {
  ...sharedTheme,
  colors: {
    background: '#efe4d6',
    card: '#f7ecde',
    surfaceMuted: '#e9dbc9',
    surfaceAlt: '#fff6ea',
    surfaceRaised: '#fffdf8',
    primary: '#e8542a',
    primaryLight: '#ff6b3d',
    muted: '#7d6f61',
    textSoft: '#5f5247',
    text: '#231b15',
    border: '#ccb8a2',
    success: '#16a34a',
    warning: '#d97706',
    danger: '#dc2626',
    info: '#0284c7',
    logBg: '#f7ecde'
  },
  accents: {
    primary: 'rgba(232,84,42,0.12)',
    success: 'rgba(22,163,74,0.12)',
    warning: 'rgba(217,119,6,0.12)',
    neutral: '#e9dbc9'
  },
  shadow: {
    card: {
      shadowColor: '#111827',
      shadowOpacity: 0.08,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2
    },
    floating: {
      shadowColor: '#111827',
      shadowOpacity: 0.12,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 6
    }
  }
} as const;

export const theme = darkTheme;

export type ThemeMode = 'light' | 'dark';

export type AppTheme = typeof darkTheme | typeof lightTheme;
