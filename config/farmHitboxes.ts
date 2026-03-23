export type FarmArea =
  | 'dom'
  | 'stodola'
  | 'sad'
  | 'ule'
  | 'rower'
  | 'pola';

export interface Hitbox {
  id: FarmArea;
  left: number;
  top: number;
  width: number;
  height: number;
  action: string;
}

export const farmHitboxes: Hitbox[] = [
  {
    id: 'dom',
    left: 18,
    top: 33,
    width: 16,
    height: 20,
    action: 'profil',
  },
  {
    id: 'stodola',
    left: 60,
    top: 28,
    width: 23,
    height: 22,
    action: 'zwierzeta',
  },
  {
    id: 'sad',
    left: 45,
    top: 52,
    width: 30,
    height: 15,
    action: 'drzewa',
  },
  {
    id: 'ule',
    left: 80,
    top: 48,
    width: 16,
    height: 17,
    action: 'ule',
  },
  {
    id: 'rower',
    left: 12,
    top: 58,
    width: 16,
    height: 20,
    action: 'miasto',
  },
  {
    id: 'pola',
    left: 40,
    top: 70,
    width: 35,
    height: 20,
    action: 'uprawy',
  },
];
