export const theme = {
  colors: {
    background: '#F1F3F5',
    card: '#FFFFFF',
    surfaceMuted: '#F8FAFC',
    surfaceAlt: '#EEF2F7',
    primary: '#2563EB',
    muted: '#6B7280',
    text: '#111827',
    border: '#E5E7EB',
    success: '#16A34A',
    warning: '#D97706',
    danger: '#DC2626',
    logBg: '#0F172A'
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
  }
} as const;
