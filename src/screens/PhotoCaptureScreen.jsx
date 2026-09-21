import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { COLORS } from '../constants/theme';
import { t } from '../locales/i18n';
import { persistPhotoLocally } from '../services/storageService';

export default function PhotoCaptureScreen({
  room,
  photos = [],
  onAddPhoto,
  onRemovePhoto,
  onFinishBooking,
  onBackToBook,
  currentLang = 'de',
  isSaving = false,
}) {
  const requestCameraPermission = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    return status === 'granted';
  };

  const handleLaunchCamera = async () => {
    try {
      const hasPermission = await requestCameraPermission();
      if (!hasPermission) {
        Alert.alert('Kamerazugriff', 'Kamerazugriff wird benötigt, um Baustellenfotos aufzunehmen.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.7,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        const permanentUri = await persistPhotoLocally(result.assets[0].uri);
        onAddPhoto(permanentUri);
      }
    } catch (e) {
      console.warn('Camera error:', e);
      Alert.alert('Kamera', 'Foto konnte nicht aufgenommen werden.');
    }
  };

  const handleLaunchLibrary = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.7,
      });

      if (!result.canceled && result.assets) {
        for (const asset of result.assets) {
          if (asset.uri) {
            const permanentUri = await persistPhotoLocally(asset.uri);
            onAddPhoto(permanentUri);
          }
        }
      }
    } catch (e) {
      console.warn('Image library error:', e);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Back Button */}
        <TouchableOpacity style={styles.backButton} onPress={onBackToBook}>
          <Text style={styles.backText}>‹ {t('backShort', currentLang)}</Text>
        </TouchableOpacity>

        {/* Header */}
        <Text style={styles.title}>
          {t('photoTitle', currentLang)} · {room.name}
        </Text>
        <Text style={styles.sub}>{t('photoSub', currentLang)}</Text>

        {/* Photos Grid */}
        <View style={styles.grid}>
          {photos.map((uri, index) => (
            <View key={index} style={styles.photoTile}>
              <Image source={{ uri }} style={styles.thumbnail} />
              <View style={styles.badgeLabel}>
                <Text style={styles.badgeText}>
                  {t('kw', currentLang)} 27 · {t('photoBadge', currentLang)} {index + 1}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => onRemovePhoto(index)}
                activeOpacity={0.7}
              >
                <Text style={styles.deleteBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}

          {/* Add Tile: Camera */}
          <TouchableOpacity
            style={[styles.addTile, styles.cameraTile]}
            onPress={handleLaunchCamera}
            activeOpacity={0.7}
          >
            <Text style={styles.addIcon}>📷</Text>
            <Text style={styles.addText}>{t('addPhotoCamera', currentLang)}</Text>
          </TouchableOpacity>

          {/* Add Tile: Gallery */}
          <TouchableOpacity
            style={styles.addTile}
            onPress={handleLaunchLibrary}
            activeOpacity={0.7}
          >
            <Text style={styles.addIcon}>🖼</Text>
            <Text style={styles.addText}>{t('addPhotoGallery', currentLang)}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.counterText}>
          {t('photoCount', currentLang, { n: photos.length })}
        </Text>
      </ScrollView>

      {/* Footer CTAs */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.finishBtn, isSaving && styles.btnDisabled]}
          onPress={onFinishBooking}
          disabled={isSaving}
          activeOpacity={0.8}
        >
          <Text style={styles.finishBtnText}>
            {isSaving ? 'Speichere...' : t('finishBooking', currentLang)}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.ghostBtn} onPress={onBackToBook}>
          <Text style={styles.ghostBtnText}>{t('backShort', currentLang)}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  scroll: {
    padding: 16,
    paddingBottom: 120,
  },
  backButton: {
    marginBottom: 8,
  },
  backText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.muted,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.ink,
  },
  sub: {
    fontSize: 12.5,
    color: COLORS.muted,
    lineHeight: 17,
    marginTop: 4,
    marginBottom: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  photoTile: {
    width: '48%',
    aspectRatio: 4 / 3,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#1E2D3E',
    position: 'relative',
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  badgeLabel: {
    position: 'absolute',
    bottom: 6,
    left: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  deleteBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(224, 83, 61, 0.85)',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  addTile: {
    width: '48%',
    aspectRatio: 4 / 3,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: COLORS.border,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },
  cameraTile: {
    borderColor: COLORS.amberDark,
    backgroundColor: COLORS.lite,
  },
  addIcon: {
    fontSize: 26,
    marginBottom: 6,
  },
  addText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.amberDark,
    textAlign: 'center',
  },
  counterText: {
    fontSize: 12,
    color: COLORS.muted,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 14,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(238, 241, 244, 0.95)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.line,
  },
  finishBtn: {
    backgroundColor: COLORS.amber,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  finishBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
  },
  ghostBtn: {
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 4,
  },
  ghostBtnText: {
    color: COLORS.muted,
    fontWeight: '700',
    fontSize: 13.5,
  },
});
