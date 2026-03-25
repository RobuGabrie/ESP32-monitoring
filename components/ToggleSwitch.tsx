import { Pressable, StyleSheet, View } from 'react-native';

interface Props {
  value: boolean;
  onChange: (value: boolean) => void;
}

export function ToggleSwitch({ value, onChange }: Props) {
  return (
    <Pressable
      onPress={(event) => {
        event.stopPropagation();
        onChange(!value);
      }}
      hitSlop={8}
    >
      <View style={[styles.track, value ? styles.trackOn : styles.trackOff]}>
        <View style={[styles.knob, value ? styles.knobOn : styles.knobOff]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: 44,
    height: 26,
    borderRadius: 999,
    justifyContent: 'center',
    paddingHorizontal: 3
  },
  trackOn: {
    backgroundColor: '#2563EB'
  },
  trackOff: {
    backgroundColor: '#D1D5DB'
  },
  knob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    transform: [{ translateX: 0 }]
  },
  knobOn: {
    transform: [{ translateX: 18 }]
  },
  knobOff: {
    transform: [{ translateX: 0 }]
  }
});
