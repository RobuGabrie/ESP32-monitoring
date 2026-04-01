export const theme = {
  colors: {
    background: '#F1F3F5',
    card: '#FFFFFF',
    surfaceMuted: '#F8FAFC',
    surfaceAlt: '#EEF2F7',
    surfaceRaised: '#FFFFFF',
    primary: '#2563EB',
    muted: '#6B7280',
    textSoft: '#475569',
    text: '#111827',
    border: '#E5E7EB',
    success: '#16A34A',
    warning: '#D97706',
    danger: '#DC2626',
    info: '#0EA5E9',
    logBg: '#0F172A'
  },
  accents: {
    primary: '#DBEAFE',
    success: '#D1FAE5',
    warning: '#FEF3C7',
    neutral: '#E2E8F0'
  },
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
  shadow: {
    card: {
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
      elevation: 3
    },
    floating: {
      shadowColor: '#000',
      shadowOpacity: 0.14,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: 6
    }
  },
  font: {
    regular: 'DMSans_400Regular',
    medium: 'DMSans_500Medium',
    semiBold: 'DMSans_500Medium',
    bold: 'DMSans_700Bold'
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
      fontFamily: 'DMSans_700Bold' as const
    }
  },
  touch: {
    minTarget: 44
  },
  chart: {
    palette: {
      temperature: '#2563EB',
      light: '#F59E0B',
      voltage: '#0F766E',
      current: '#DC2626',
      rssi: '#10B981'
    },
    strokeWidth: {
      normal: 2.15,
      emphasized: 2.35
    },
    fillOpacity: {
      start: 0.18,
      end: 0.04
    }
  }
} as const;
