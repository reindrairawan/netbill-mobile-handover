import { useState } from 'react';
import {
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
  type TextInputProps,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface PasswordInputProps extends Omit<TextInputProps, 'secureTextEntry' | 'style'> {
  /**
   * Style kotak input yang biasa dipakai (styles.inputField / sharedStyles.modalInput).
   * Dipasang di WADAH baris, bukan di TextInput, supaya ikon mata duduk di dalam kotak
   * dan tidak menimpa teks. fontSize & color tetap diteruskan ke TextInput-nya.
   * Bertipe gabungan karena style tersebut memang mencampur properti kotak (padding,
   * border) dengan properti teks (fontSize, color).
   */
  style?: StyleProp<ViewStyle & TextStyle>;
}

/** Input kata sandi dengan tombol mata untuk menampilkan/menyembunyikan isinya. */
export function PasswordInput({ style, ...inputProps }: PasswordInputProps) {
  const [isVisible, setIsVisible] = useState(false);
  const flat = StyleSheet.flatten(style) as TextStyle | undefined;

  return (
    <View style={[style as StyleProp<ViewStyle>, styles.row]}>
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        {...inputProps}
        style={[styles.input, { fontSize: flat?.fontSize, color: flat?.color }]}
        secureTextEntry={!isVisible}
      />
      <TouchableOpacity
        onPress={() => setIsVisible((v) => !v)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityRole="button"
        accessibilityLabel={isVisible ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
      >
        <MaterialIcons name={isVisible ? 'visibility-off' : 'visibility'} size={20} color="#434654" style={styles.icon} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    // Padding sudah disediakan wadah; tanpa ini Android menambah padding bawaannya sendiri.
    padding: 0,
  },
  icon: {
    marginLeft: 10,
  },
});
