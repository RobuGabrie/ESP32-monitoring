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
    background: '#EDEEF2',
    card: '#FFFFFF',
    surface: '#F2F3F7',
    surfaceMuted: '#E6E9F0',
    surfaceAlt: '#F8FAFC',
    surfaceRaised: '#ffffff',
    primary: '#2FCFB4',
    secondary: '#171717',
    primaryLight: '#69DFCC',
    muted: '#9DA3B4',
    textSoft: '#6C7386',
    text: '#171717',
    border: '#DFE3EC',
    success: '#2FCFB4',
    warning: '#FFB547',
    error: '#FF5D7C',
    danger: '#FF5D7C',
    info: '#38BDF8',
    logBg: '#FFFFFF'
  },
  accents: {
    primary: 'rgba(47,207,180,0.12)',
    success: 'rgba(47,207,180,0.12)',
    warning: 'rgba(255,181,71,0.14)',
    neutral: '#EEF1F7'
  },
  shadow: {
    card: {
      shadowColor: '#0B1020',
      shadowOpacity: 0.08,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 5 },
      elevation: 3
    },
    floating: {
      shadowColor: '#0B1020',
      shadowOpacity: 0.14,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 12 },
      elevation: 7
    }
  }
} as const;

export const theme = lightTheme;

export type ThemeMode = 'light' | 'dark';

export type AppTheme = typeof darkTheme | typeof lightTheme;
