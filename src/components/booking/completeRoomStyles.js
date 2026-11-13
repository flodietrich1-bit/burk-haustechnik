import { StyleSheet } from 'react-native';
import { COLORS } from '../../constants/theme';

export const styles = StyleSheet.create({
  completeModalScreen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  completeModalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  completeModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  completeModalTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#234E52',
  },
  closeBtnText: {
    fontSize: 24,
    color: COLORS.muted,
    fontWeight: '700',
    padding: 4,
  },
  completeModalSub: {
    fontSize: 13,
    color: COLORS.muted,
    marginBottom: 10,
  },
  completeNoticeText: {
    fontSize: 12,
    color: COLORS.inkSoft,
    lineHeight: 17,
    marginBottom: 12,
  },
  deltaScrollList: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    marginBottom: 12,
  },
  deltaScrollContent: {
    padding: 10,
  },
  deltaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF2F7',
  },
  deltaMatName: {
    fontSize: 12.5,
    fontWeight: '700',
    color: COLORS.ink,
  },
  deltaMatSub: {
    fontSize: 11,
    color: COLORS.muted,
    marginTop: 1,
  },
  deltaBadgeUnder: {
    backgroundColor: '#E6FFFA',
    borderWidth: 1,
    borderColor: '#38B2AC',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  deltaBadgeUnderText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#234E52',
  },
  deltaBadgeOver: {
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: '#FEB2B2',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  deltaBadgeOverText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#9B2C2C',
  },
  deltaBadgeExact: {
    backgroundColor: '#EDF2F7',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  deltaBadgeExactText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: COLORS.muted,
  },
  completeActionRow: {
    paddingBottom: 12,
  },
  completeConfirmBtn: {
    minHeight: 56,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: COLORS.green,
    alignItems: 'center',
  },
  completeConfirmText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
  },
});
