const sharedTheme = {
  spacing: {
    xs: 6,
    sm: 10,
    md: 14,
    lg: 18,
    xl: 24
  },
  radius: {
    sm: 12,
    md: 18,
    lg: 24,
    xl: 30
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
    caption: {
      fontSize: 11,
      lineHeight: 14,
      fontFamily: 'DMSans_500Medium' as const
    },
    bodySm: {
      fontSize: 13,
      lineHeight: 18,
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
      lineHeight: 24,
      fontFamily: 'DMSans_700Bold' as const
    },
    cardLabel: {
      fontSize: 13,
      lineHeight: 16,
      fontFamily: 'DMSans_500Medium' as const
    },
    cardValue: {
      fontSize: 28,
      lineHeight: 34,
      fontFamily: 'JetBrainsMono_400Regular' as const
    },
    cardValueLarge: {
      fontSize: 32,
      lineHeight: 38,
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
    surface: '#202020',
    surfaceMuted: '#202020',
    surfaceAlt: '#202020',
    surfaceRaised: '#202020',
    primary: '#e8542a',
    secondary: '#38BDF8',
    primaryLight: '#ff6b3d',
    muted: '#555555',
    textSoft: '#888888',
    text: '#f0f0f0',
    border: '#2a2a2a',
    success: '#3ddc84',
    warning: '#F59E0B',
    error: '#e84040',
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
    background: '#f4ece3',
    card: '#fff8f0',
    surface: '#fdf4e9',
    surfaceMuted: '#f1e2d2',
    surfaceAlt: '#fffaf5',
    surfaceRaised: '#ffffff',
    primary: '#f26a2d',
    secondary: '#0f8ecf',
    primaryLight: '#ff8a4c',
    muted: '#8b7664',
    textSoft: '#6b5a4c',
    text: '#211813',
    border: '#e4d3c1',
    success: '#1f9d55',
    warning: '#e08a1e',
    error: '#de5343',
    danger: '#de5343',
    info: '#0f8ecf',
    logBg: '#fff8f0'
  },
  accents: {
    primary: 'rgba(242,106,45,0.12)',
    success: 'rgba(31,157,85,0.12)',
    warning: 'rgba(224,138,30,0.12)',
    neutral: '#efe2d2'
  },
  shadow: {
    card: {
      shadowColor: '#6d4a2f',
      shadowOpacity: 0.08,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 3 },
      elevation: 3
    },
    floating: {
      shadowColor: '#6d4a2f',
      shadowOpacity: 0.14,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 10 },
      elevation: 7
    }
  }
} as const;

export const theme = lightTheme;

export type ThemeMode = 'light' | 'dark';

export type AppTheme = typeof darkTheme | typeof lightTheme;
