export type FarmArea = 'dom' | 'stodola' | 'sad' | 'ule' | 'rower' | 'pola';

export interface FarmHitbox {
  id: FarmArea;
  label: string;
  left: number;
  top: number;
  width: number;
  height: number;
  action: string;
}

export const FARM_HITBOXES: FarmHitbox[] = [
  {
    id: 'dom',
    label: 'DOM',
    left: 18,
    top: 33,
    width: 16,
    height: 20,
    action: 'profil',
  },
  {
    id: 'stodola',
    label: 'STODOŁA',
    left: 60,
    top: 28,
    width: 23,
    height: 22,
    action: 'zwierzeta',
  },
  {
    id: 'sad',
    label: 'SAD',
    left: 45,
    top: 52,
    width: 30,
    height: 15,
    action: 'drzewa',
  },
  {
    id: 'ule',
    label: 'ULE',
    left: 80,
    top: 48,
    width: 16,
    height: 17,
    action: 'ule',
  },
  {
    id: 'rower',
    label: 'ROWER',
    left: 12,
    top: 58,
    width: 16,
    height: 20,
    action: 'miasto',
  },
  {
    id: 'pola',
    label: 'POLA UPRAWNE',
    left: 40,
    top: 70,
    width: 35,
    height: 20,
    action: 'uprawy',
  },
];
